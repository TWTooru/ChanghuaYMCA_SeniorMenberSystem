function mapCatalogRow(row) {
  return {
    courseCatalogId: row.course_catalog_id,
    courseName: row.course_name,
    active: Boolean(row.active),
  }
}

export async function fetchCourseCatalog(client) {
  const { data, error } = await client
    .from('course_catalog')
    .select('course_catalog_id, course_name, active')
    .order('course_name')

  if (error) throw error
  return (data || []).map(mapCatalogRow)
}

export async function saveCourseCatalogEntry(client, courseName) {
  const normalizedName = String(courseName ?? '').trim()
  if (!normalizedName) throw new Error('課程名稱為必填')

  const { data, error } = await client.rpc('upsert_course_catalog', {
    p_course_name: normalizedName,
  })

  if (error) throw error
  return mapCatalogRow(Array.isArray(data) ? data[0] : data)
}

export async function deactivateCourseCatalogEntry(client, courseCatalogId) {
  const { error } = await client
    .from('course_catalog')
    .update({ active: false })
    .eq('course_catalog_id', courseCatalogId)

  if (error) throw error
}
