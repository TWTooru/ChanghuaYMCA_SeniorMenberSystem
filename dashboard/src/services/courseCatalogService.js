/**
 * 封裝 `course_catalog` 的讀寫與前端欄位轉換；新增與重新啟用皆交由
 * `upsert_course_catalog` RPC 處理。
 */
/** 將 `course_catalog` 資料列轉為前端使用的駝峰命名形狀。 */
function mapCatalogRow(row) {
  return {
    courseCatalogId: row.course_catalog_id,
    courseName: row.course_name,
    active: Boolean(row.active),
  }
}

/** 讀取依 `course_name` 排序的課程目錄，並正規化資料列欄位。 */
export async function fetchCourseCatalog(client) {
  const { data, error } = await client
    .from('course_catalog')
    .select('course_catalog_id, course_name, active')
    .order('course_name')

  if (error) throw error
  return (data || []).map(mapCatalogRow)
}

/**
 * 透過 `upsert_course_catalog` 新增或重新啟用修剪後的課程名稱；RPC 負責併發與
 * 唯一性規則，服務回傳 UI 使用的課程目錄形狀。
 */
export async function saveCourseCatalogEntry(client, courseName) {
  const normalizedName = String(courseName ?? '').trim()
  if (!normalizedName) throw new Error('課程名稱為必填')

  const { data, error } = await client.rpc('upsert_course_catalog', {
    p_course_name: normalizedName,
  })

  if (error) throw error
  return mapCatalogRow(Array.isArray(data) ? data[0] : data)
}

/** 將指定 `course_catalog` 項目停用，而非刪除歷史課程名稱。 */
export async function deactivateCourseCatalogEntry(client, courseCatalogId) {
  const { error } = await client
    .from('course_catalog')
    .update({ active: false })
    .eq('course_catalog_id', courseCatalogId)

  if (error) throw error
}
