import { describe, expect, it } from 'vitest'
import {
  normalizePaymentAmount,
  normalizePaymentRecords,
  reconcilePaymentRecords,
} from './enrollmentPayments'

describe('normalizePaymentAmount', () => {
  it.each([
    [0, 0],
    [1200, 1200],
    [' 3000 ', 3000],
  ])('normalizes valid amount %p', (value, expected) => {
    expect(normalizePaymentAmount(value)).toBe(expected)
  })

  it.each(['', '   ', -1, '-1', 1.5, '1.5', 'abc', 2147483648, Number.MAX_SAFE_INTEGER + 1, Infinity])(
    'rejects invalid amount %p', value => {
      expect(() => normalizePaymentAmount(value)).toThrow(new Error('??敹???0 ?迤?湔'))
    },
  )
})

describe('normalizePaymentRecords', () => {
  it('normalizes single and multi-course records', () => {
    expect(normalizePaymentRecords([
      { localId: 'a', courseNames: ['??'], amount: ' 1200 ', invoiceNumber: ' INV-1 ' },
      { localId: 'b', courseNames: ['?謅??鈭亦畦', '?謅??鈭亦畦', '????殉瘥'], amount: 0, invoiceNumber: '  ' },
    ], ['??', '?謅??鈭亦畦', '????殉瘥'])).toEqual([
      { course_names: ['??'], amount: 1200, invoice_number: 'INV-1' },
      { course_names: ['?謅??鈭亦畦', '????殉瘥'], amount: 0, invoice_number: null },
    ])
  })

  it('accepts no payment records', () => {
    expect(normalizePaymentRecords([], ['??'])).toEqual([])
  })

  it('rejects empty course assignment', () => {
    expect(() => normalizePaymentRecords([
      { courseNames: [], amount: 100, invoiceNumber: '' },
    ], ['??'])).toThrow(new Error('蝜唾祥蝝???撠???隤脩?'))
  })

  it('rejects unselected and duplicated course assignments', () => {
    expect(() => normalizePaymentRecords([
      { courseNames: ['other'], amount: 100, invoiceNumber: '' },
    ], ['??'])).toThrow(new Error('蝜唾祥蝝???急?豢??玨蝔'))
    expect(() => normalizePaymentRecords([
      { courseNames: ['??'], amount: 100, invoiceNumber: '' },
      { courseNames: ['??'], amount: 200, invoiceNumber: '' },
    ], ['??'])).toThrow(new Error('???隤脖??賢?曉憭?蝜唾祥蝝?'))
  })
})

describe('reconcilePaymentRecords', () => {
  it('removes deselected courses and drops empty drafts while preserving metadata', () => {
    const records = [
      { localId: 'a', courseNames: ['keep', 'drop'], amount: '1200', invoiceNumber: ' I-1 ' },
      { localId: 'b', courseNames: ['drop'], amount: 0, invoiceNumber: null },
    ]
    expect(reconcilePaymentRecords(records, ['keep'])).toEqual([
      { localId: 'a', courseNames: ['keep'], amount: '1200', invoiceNumber: ' I-1 ' },
    ])
  })
})
