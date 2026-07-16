import { describe, expect, it } from 'vitest'
import { parseTabularRows } from './seasonImport'

const basic = { 姓名: ' 王小明 ', 性別: '男', 出生日期: '1960/07/17', 手機電話: '0912-345-678' }

describe('parseTabularRows', () => {
  it('parses one-quarter rows and deduplicates courses', () => {
    const result = parseTabularRows([{ ...basic, 學員編號: '', 第16季前測: '80', '第16季新、續': '新', 課程1: '肌力', 課程2: ' 肌力 ' }], { today: new Date('2026-07-16') })
    expect(result.mode).toBe('single-season')
    expect(result.seasons).toEqual(['第十六季'])
    expect(result.rows[0].provided_student_id).toBeNull()
    expect(result.rows[0].student.age).toBe(65)
    expect(result.rows[0].student.is_60_plus).toBe('是')
    expect(result.rows[0].enrollments[0].courses).toEqual(['肌力'])
  })

  it('parses the historical quarter-fourteen aliases', () => {
    const result = parseTabularRows([{ ...basic, 學員編號: '3', 第十四季14期前: '70', 第十四季14期後: '85', 第十四季課程1: '攝影' }])
    expect(result.mode).toBe('single-season')
    expect(result.rows[0].enrollments[0]).toMatchObject({ season: '第十四季', pre_test: '70', post_test: '85', courses: ['攝影'] })
  })

  it('blocks missing names, invalid dates, and mixed quarters in a recurring file', () => {
    const result = parseTabularRows([{ 姓名: '', 出生日期: 'not-a-date', 第16季前測: '70', 第17季後測: '80', 課程1: '肌力' }])
    expect(result.errors.map(error => error.field)).toEqual(expect.arrayContaining(['姓名', '出生日期', '季度']))
  })

  it('creates an enrollment when only a test field has data', () => {
    const result = parseTabularRows([{ ...basic, 學員編號: '3', 第十五季前測: '2026/03/05' }])
    expect(result.rows[0].enrollments).toHaveLength(1)
  })
})
