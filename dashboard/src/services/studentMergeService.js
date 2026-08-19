export async function mergeStudents(client, sourceId, targetId) {
  const { data, error } = await client.rpc('merge_students', {
    p_source_id: sourceId,
    p_target_id: targetId
  });

  if (error) {
    let friendlyMessage = `合併失敗：${error.message}`;
    if (error.message.includes('FORBIDDEN')) {
      friendlyMessage = '僅管理員可執行學員合併操作。';
    } else if (error.message.includes('SOURCE_NOT_FOUND')) {
      friendlyMessage = '找不到來源學員，可能已被刪除。';
    } else if (error.message.includes('TARGET_NOT_FOUND')) {
      friendlyMessage = '找不到目標學員，可能已被刪除。';
    } else if (error.message.includes('SAME_STUDENT')) {
      friendlyMessage = '來源與目標不可為同一位學員。';
    }
    throw new Error(friendlyMessage);
  }

  return data;
}
