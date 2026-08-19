const MERGE_ERROR_MESSAGES = {
  FORBIDDEN: '僅管理員可執行學員合併操作。',
  SOURCE_NOT_FOUND: '找不到來源學員，可能已被刪除。',
  TARGET_NOT_FOUND: '找不到目標學員，可能已被刪除。',
  SAME_STUDENT: '來源與目標不可為同一位學員。',
}

function mapMergeError(message) {
  for (const [code, text] of Object.entries(MERGE_ERROR_MESSAGES)) {
    if (message?.includes(code)) return text
  }
  return `合併失敗：${message}`
}

export async function mergeStudents(client, sourceId, targetId) {
  const { data, error } = await client.rpc('merge_students', {
    p_source_id: String(sourceId),
    p_target_id: String(targetId),
  })
  if (error) throw new Error(mapMergeError(error.message))
  return data
}
