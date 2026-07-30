/**
 * 封裝選課與課程資料的異動；建立流程會在課程寫入失敗時補償刪除選課紀錄，
 * 更新流程則透過 RPC 維持選課與課程清單的一致性。
 */
/** 去除空白與重複值，產生可寫入 `courses` 的課程名稱清單。 */
export function normalizeSelectedCourseNames(courses = []) {
  return [...new Set(
    (Array.isArray(courses) ? courses : [])
      .map(course => String(course ?? '').trim())
      .filter(Boolean)
  )]
}

/**
 * 先建立 `enrollments`，再新增去重後的 `courses`；若課程新增失敗，會刪除剛建立的
 * 選課紀錄作為補償，避免留下不完整資料。
 */
export async function createEnrollmentWithCourses(client, studentId, form) {
  const { season, reg_type, pre_test, post_test, refunded, refund_info, courses } = form
  const enrollmentData = {
    season,
    reg_type,
    pre_test,
    post_test,
    refunded: refunded ? 1 : 0,
    refund_info,
    student_id: studentId
  }

  const { data: insertedEnrollment, error } = await client
    .from('enrollments')
    .insert([enrollmentData])
    .select()
    .single()

  if (error) throw error

  const courseList = normalizeSelectedCourseNames(courses)
  if (courseList.length === 0) return insertedEnrollment

  const courseData = courseList.map(courseName => ({
    enrollment_id: insertedEnrollment.enrollment_id,
    course_name: courseName
  }))

  const { error: courseError } = await client.from('courses').insert(courseData)
  if (!courseError) return insertedEnrollment

  const { error: rollbackError } = await client
    .from('enrollments')
    .delete()
    .eq('enrollment_id', insertedEnrollment.enrollment_id)

  if (rollbackError) {
    throw new Error(`course insert failed and rollback failed: ${rollbackError.message}. Original error: ${courseError.message}`)
  }

  throw new Error(`課程新增失敗，已取消此選課紀錄。(${courseError.message})`)
}

/**
 * 透過 `update_enrollment_with_courses` 一次更新選課中繼資料與課程清單。
 * RPC 會維護原子性；服務僅將已知錯誤碼轉為 UI 訊息。
 */
export async function updateEnrollmentWithCourses(client, enrollmentId, form) {
  const { season, reg_type, pre_test, post_test, refunded, refund_info, courses } = form
  const courseNames = normalizeSelectedCourseNames(courses)
  if (courseNames.length === 0) throw new Error('請至少選擇一門課程')

  const { error } = await client.rpc('update_enrollment_with_courses', {
    p_enrollment_id: enrollmentId,
    p_season: season,
    p_reg_type: reg_type,
    p_pre_test: pre_test,
    p_post_test: post_test,
    p_refunded: refunded ? 1 : 0,
    p_refund_info: refund_info,
    p_course_names: courseNames,
  })

  if (!error) return

  const mappedMessage = {
    COURSE_RECEIPT_LOCKED: '已有收據的課程不能移除',
    COURSE_REQUIRED: '請至少選擇一門課程',
  }[error.message]
  throw new Error(mappedMessage || error.message)
}

/** 依 `enrollment_id` 刪除選課；關聯的 `courses` 由資料庫級聯規則處理。 */
export async function deleteEnrollment(client, enrollmentId) {
  const { error } = await client.from('enrollments').delete().eq('enrollment_id', enrollmentId)
  if (error) throw error
}

export async function updateEnrollmentRefundStatus(client, enrollmentId, refunded, refundInfo) {
  const { error } = await client
    .from('enrollments')
    .update({ refunded: refunded ? 1 : 0, refund_info: refundInfo || null })
    .eq('enrollment_id', enrollmentId)

  if (error) throw error
}

