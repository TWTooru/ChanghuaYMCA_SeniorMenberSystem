import { describe, expect, it, vi } from 'vitest'
import { createStudent, createStudentWithInitialEnrollment, updateStudent } from './studentService'

const profile = {
  name: '王小明', gender: '男', phone: '0912-345-678', birth_date: '1980-07-01',
  address: '台北市', organization: 'YMCA', education: '專科/大學', email: 'member@example.com',
}

const enrollment = {
  period: '第16期', period_start_date: '2026-09-01', period_end_date: '2026-12-31',
  courses: ['會計實務'], notes: null, prepaid_amount: 500,
  prepaid_receipt_number: 'P-1', tuition_fee: 2400, materials_fee: 300,
  membership_fee: 100, fee_receipt_number: 'F-1', handled_by_name: '林承辦',
  handled_on: '2026-08-17', handled_by_user_id: 'spoof', handled_by_account: 'spoof@example.com',
}

describe('member profile service', () => {
  it('creates a member and first enrollment through one RPC without trusted actor fields', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: { student_id: '61', enrollment_id: '91' }, error: null }) }

    await expect(createStudentWithInitialEnrollment(client, profile, enrollment)).resolves.toEqual({
      student_id: 61,
      enrollment_id: 91,
    })
    expect(client.rpc).toHaveBeenCalledWith('create_student_with_initial_enrollment', expect.anything())
    const [, payload] = client.rpc.mock.calls[0]
    expect(payload).toEqual({
      p_student: profile,
      p_enrollment: {
        period: '第16期', period_start_date: '2026-09-01', period_end_date: '2026-12-31',
        courses: ['會計實務'], notes: null, prepaid_amount: 500,
        prepaid_receipt_number: 'P-1', tuition_fee: 2400, materials_fee: 300,
        membership_fee: 100, fee_receipt_number: 'F-1', handled_by_name: '林承辦',
        handled_on: '2026-08-17',
      },
    })
    expect(payload.p_enrollment).not.toHaveProperty('handled_by_user_id')
    expect(payload.p_enrollment).not.toHaveProperty('handled_by_account')
  })

  it.each([
    ['PERIOD_INVALID', '請輸入有效期別，例如：第16期'],
    ['PERIOD_DATES_REQUIRED', '請選擇開始日期與結束日期'],
    ['PERIOD_DATE_INVALID', '日期格式不正確'],
    ['PERIOD_DATE_ORDER_INVALID', '結束日期不得早於開始日期'],
    ['COURSE_REQUIRED', '請至少選擇一門課程'],
    ['FEE_AMOUNT_INVALID', '金額必須是 0 或正整數'],
    ['HANDLED_ON_INVALID', '辦理日期格式不正確'],
    ['AUTH_ACCOUNT_REQUIRED', '無法取得目前登入帳號，請重新登入'],
    ['INVALID_STUDENT_ID', '會員 ID 必須是大於 0 的整數'],
    ['INVALID_BIRTH_DATE', '出生年月日格式不正確'],
    ['INITIAL_ENROLLMENT_CREATE_FORBIDDEN', '您沒有建立會員及報名的權限'],
  ])('maps %s to a stable message', async (databaseMessage, expectedMessage) => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: null, error: new Error(databaseMessage) }) }
    await expect(createStudentWithInitialEnrollment(client, profile, enrollment)).rejects.toThrow(expectedMessage)
  })

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
