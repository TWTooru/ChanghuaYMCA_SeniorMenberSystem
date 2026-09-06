import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MemberProfileStep from './MemberProfileStep'

const profile = {
  student_id: '1001',
  name: '王小明',
  gender: '男',
  email: 'member@example.com',
  phone: '0912345678',
  birth_date: '2000-01-01',
  address: '彰化市',
  organization: 'YMCA',
  education: '高中',
}

describe('MemberProfileStep', () => {
  afterEach(cleanup)

  it('keeps the established member profile field contract', () => {
    render(<MemberProfileStep profile={profile} onChange={vi.fn()} disabled={false} />)

    expect(screen.getByLabelText('ID（選填）')).not.toBeNull()
    expect(screen.getByLabelText('ID（選填）').required).toBe(false)
    expect(screen.getByLabelText('姓名').required).toBe(true)
    expect(screen.getByLabelText('性別').required).toBe(true)
    expect(screen.getByLabelText('教育程度').required).toBe(false)
    for (const label of ['電子郵件', '電話', '出生年月日', '通訊處', '服務機關 / 學校']) {
      expect(screen.getByLabelText(label)).not.toBeNull()
    }
  })
})
