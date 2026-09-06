import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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

async function selectOption(label, optionName) {
  fireEvent.click(screen.getByRole('combobox', { name: label }))
  const option = await screen.findByRole('option', { name: optionName, exact: true })
  fireEvent.pointerDown(option, { pointerType: 'mouse' })
  fireEvent.click(option)
}

describe('MemberProfileStep', () => {
  afterEach(cleanup)

  it('keeps the established member profile field contract', () => {
    render(<MemberProfileStep profile={profile} onChange={vi.fn()} disabled={false} />)

    expect(screen.getByLabelText('ID（選填）')).not.toBeNull()
    expect(screen.getByLabelText('ID（選填）').required).toBe(false)
    expect(screen.getByLabelText('姓名').required).toBe(true)
    expect(screen.getByRole('combobox', { name: '性別' }).getAttribute('aria-required')).toBe('true')
    expect(screen.getByRole('combobox', { name: '教育程度' }).getAttribute('aria-required')).not.toBe('true')
    for (const label of ['電子郵件', '電話', '出生年月日', '通訊處', '服務機關 / 學校']) {
      expect(screen.getByLabelText(label)).not.toBeNull()
    }
  })

  it('maps clearing education back to the existing change contract', async () => {
    const onChange = vi.fn()
    render(<MemberProfileStep profile={profile} onChange={onChange} />)

    await selectOption('教育程度', '請選擇')

    expect(onChange).toHaveBeenLastCalledWith({ target: { name: 'education', value: '' } })
  })

  it('maps selecting female back to the existing change contract', async () => {
    const onChange = vi.fn()
    render(<MemberProfileStep profile={profile} onChange={onChange} />)

    await selectOption('性別', '女')

    expect(onChange).toHaveBeenLastCalledWith({ target: { name: 'gender', value: '女' } })
  })

  it('does not report a profile change before the user selects an option', () => {
    const onChange = vi.fn()

    render(<MemberProfileStep profile={profile} onChange={onChange} />)

    expect(onChange).not.toHaveBeenCalled()
  })

  it('associates each select label with its trigger', () => {
    render(<MemberProfileStep profile={profile} onChange={vi.fn()} />)

    expect(screen.getByLabelText('性別')).toBe(screen.getByRole('combobox', { name: '性別' }))
    expect(screen.getByLabelText('教育程度')).toBe(screen.getByRole('combobox', { name: '教育程度' }))
  })

  it('disables both profile selects while busy', () => {
    render(<MemberProfileStep profile={profile} onChange={vi.fn()} disabled />)

    expect(screen.getByRole('combobox', { name: '性別' }).disabled).toBe(true)
    expect(screen.getByRole('combobox', { name: '教育程度' }).disabled).toBe(true)
    expect(screen.getByLabelText('姓名').disabled).toBe(true)
  })
})
