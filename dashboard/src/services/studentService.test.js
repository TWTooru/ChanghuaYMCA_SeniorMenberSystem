import { describe, expect, it, vi } from 'vitest'
import { createStudent, updateStudent } from './studentService'

const profile = {
  name: '王小明', gender: '男', phone: '0912-345-678', birth_date: '1980-07-01',
  address: '台北市', organization: 'YMCA', education: '專科/大學', email: 'member@example.com',
}

describe('member profile service', () => {
  it('creates a final-profile row and returns its database-assigned ID', async () => {
    const insert = vi.fn(() => ({ select: () => ({ single: async () => ({ data: { ...profile, student_id: 51 }, error: null }) }) }))
    const client = { from: vi.fn(() => ({ insert })) }

    await expect(createStudent(client, profile)).resolves.toEqual({ ...profile, student_id: 51 })
    expect(client.from).toHaveBeenCalledWith('students')
    expect(insert).toHaveBeenCalledWith(profile)
  })

  it('omits a blank member ID so the database can allocate it', async () => {
    const insert = vi.fn(() => ({ select: () => ({ single: async () => ({ data: { ...profile, student_id: 52 }, error: null }) }) }))
    const client = { from: vi.fn(() => ({ insert })) }

    await expect(createStudent(client, { ...profile, student_id: null })).resolves.toEqual({ ...profile, student_id: 52 })
    expect(insert).toHaveBeenCalledWith(profile)
  })

  it('updates a member through the numeric-ID profile RPC', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: { ...profile, student_id: 12 }, error: null }) }

    await expect(updateStudent(client, '12', profile)).resolves.toEqual({ ...profile, student_id: 12 })
    expect(client.rpc).toHaveBeenCalledWith('update_student_profile', {
      p_original_id: 12,
      p_student: profile,
    })
  })

  it('maps member validation errors to stable messages', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: null, error: new Error('DUPLICATE_EMAIL') }) }
    await expect(updateStudent(client, 12, profile)).rejects.toThrow('電子郵件已被其他會員使用')
  })
})
