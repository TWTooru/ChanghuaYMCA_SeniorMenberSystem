import { describe, expect, it } from 'vitest'
import { classifyMemberImport } from './importPreviewService'

const student = (overrides = {}) => ({
  email: null, name: '王小明', gender: '男', phone: '0912-345-678', birth_date: '1980-07-01',
  address: null, organization: null, education: '高中', ...overrides,
})
const parsed = rows => ({ rows: rows.map((value, index) => ({ source_row: index + 2, student: value })), warnings: [], errors: [] })

describe('member import preview reconciliation', () => {
  it('matches an existing member by normalized email and reports changed Chinese field labels', () => {
    const preview = classifyMemberImport(parsed([student({ email: 'MEMBER@example.com', phone: '0912345678', address: '台北市' })]), {
      students: [{ student_id: 12, ...student({ email: 'member@example.com', address: '新北市' }) }],
    })

    expect(preview).toMatchObject({
      summary: { fileRows: 1, newStudents: 0, updatedStudents: 1, currentStudents: 1 },
      studentResolutions: [{ sourceRow: 2, action: 'update', studentId: 12, matchedBy: '電子郵件', changedFields: ['通訊處'] }],
      hasBlockingErrors: false,
    })
    expect(preview.payload.rows).toHaveLength(1)
  })

  it('matches by complete fallback identity, warns on incomplete no-email identity, and treats it as new', () => {
    const preview = classifyMemberImport(parsed([
      student({ email: null }),
      student({ name: '新會員', email: null, phone: null, birth_date: null }),
    ]), { students: [{ student_id: 12, ...student({ email: null }) }] })

    expect(preview.summary).toMatchObject({ newStudents: 1, updatedStudents: 1 })
    expect(preview.studentResolutions[0]).toMatchObject({ matchedBy: '姓名、電話、出生年月日' })
    expect(preview.warnings).toContainEqual(expect.objectContaining({ row: 3, field: '識別資料' }))
  })

  it('blocks conflicting email and fallback matches plus same-file duplicate email', () => {
    const conflict = student({ email: 'one@example.com', name: '第二人' })
    const duplicate = student({ email: 'one@example.com', name: '第三人', phone: null, birth_date: null })
    const preview = classifyMemberImport(parsed([conflict, duplicate]), {
      students: [
        { student_id: 12, ...student({ email: 'one@example.com' }) },
        { student_id: 13, ...student({ email: null, name: '第二人' }) },
      ],
    })

    expect(preview.hasBlockingErrors).toBe(true)
    expect(preview.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 2, message: 'IDENTITY_CONFLICT' }),
      expect.objectContaining({ row: 3, message: 'DUPLICATE_EMAIL' }),
    ]))
  })
})
