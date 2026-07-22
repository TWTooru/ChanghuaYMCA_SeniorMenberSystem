export async function createStudent(client, studentData) {
  const { error } = await client.from('students').insert([studentData])
  if (error) throw error
}

export async function updateStudent(client, studentId, payload) {
  const { error } = await client.from('students').update(payload).eq('student_id', studentId)
  if (error) throw error
}

export async function deleteStudent(client, studentId) {
  const { error } = await client.from('students').delete().eq('student_id', studentId)
  if (error) throw error
}
