import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import PaymentRecordsEditor from './PaymentRecordsEditor'

function Harness({ selectedCourseNames = ['A', 'B', 'C'], disabled = false }) {
  const [records, setRecords] = useState([])

  return (
    <PaymentRecordsEditor
      selectedCourseNames={selectedCourseNames}
      records={records}
      onChange={setRecords}
      disabled={disabled}
    />
  )
}

afterEach(cleanup)

describe('PaymentRecordsEditor', () => {
  it('creates a draft and assigns multiple courses to one payment', () => {
    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: '新增繳費紀錄' }))
    fireEvent.click(screen.getByLabelText('A'))
    fireEvent.click(screen.getByLabelText('B'))
    fireEvent.change(screen.getByLabelText('總金額'), { target: { value: '3000' } })
    fireEvent.change(screen.getByLabelText('發票編號'), { target: { value: 'R-1' } })

    expect(screen.getByLabelText('A').checked).toBe(true)
    expect(screen.getByLabelText('B').checked).toBe(true)
    expect(screen.getByDisplayValue('3000')).toBeTruthy()
    expect(screen.getByDisplayValue('R-1')).toBeTruthy()
  })

  it('prevents a course assigned to another payment from being selected again', () => {
    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: '新增繳費紀錄' }))
    fireEvent.click(screen.getByLabelText('A'))
    fireEvent.click(screen.getByRole('button', { name: '新增繳費紀錄' }))

    expect(screen.getAllByLabelText('A').at(-1).disabled).toBe(true)
  })

  it('releases a course when its draft is removed', () => {
    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: '新增繳費紀錄' }))
    fireEvent.click(screen.getByLabelText('A'))
    fireEvent.click(screen.getByRole('button', { name: '新增繳費紀錄' }))
    fireEvent.click(screen.getAllByRole('button', { name: '移除繳費紀錄' })[0])

    expect(screen.getByLabelText('A').disabled).toBe(false)
  })

  it('disables adding once every selected course is assigned', () => {
    render(<Harness selectedCourseNames={['A']} />)

    fireEvent.click(screen.getByRole('button', { name: '新增繳費紀錄' }))
    fireEvent.click(screen.getByLabelText('A'))

    expect(screen.getByRole('button', { name: '新增繳費紀錄' }).disabled).toBe(true)
  })

  it('disables every input and button when disabled', () => {
    render(
      <PaymentRecordsEditor
        selectedCourseNames={['A']}
        records={[{ localId: 'payment-7', courseNames: ['A'], amount: '100', invoiceNumber: 'R-7' }]}
        onChange={() => {}}
        disabled
      />
    )

    expect(screen.getByRole('button', { name: '新增繳費紀錄' }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: '移除繳費紀錄' }).disabled).toBe(true)
    expect(screen.getByLabelText('A').disabled).toBe(true)
    expect(screen.getByLabelText('總金額').disabled).toBe(true)
    expect(screen.getByLabelText('發票編號').disabled).toBe(true)
  })

  it('uses readable legends and unique input IDs for each payment draft', () => {
    render(
      <PaymentRecordsEditor
        selectedCourseNames={['A']}
        records={[
          { localId: 'payment-7', courseNames: [], amount: '', invoiceNumber: '' },
          { localId: 'payment-8', courseNames: [], amount: '', invoiceNumber: '' },
        ]}
        onChange={() => {}}
      />
    )

    expect(screen.getByRole('group', { name: '繳費紀錄 1' })).toBeTruthy()
    expect(screen.getByRole('group', { name: '繳費紀錄 2' })).toBeTruthy()
    const ids = Array.from(document.querySelectorAll('input')).map(input => input.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
