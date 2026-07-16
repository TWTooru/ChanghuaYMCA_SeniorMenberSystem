import { describe, expect, it } from 'vitest'
import { normalizeCsvDate, parseQuarterCsvRows } from './quarterCsvImport'

const fixedHeaders = [
  '學員編號', '姓名', '性別', '出生日期', '目前年齡', '是否60歲', '地址', '家裡電話',
  '手機電話', '主要聯絡人', '關係', '聯絡人電話', '教育程度', '職業'
]
const headers = [...fixedHeaders, '第16季前測', '第16季後測', '第16季(新、續)', '課程1', '課程2', '課程3', '備註欄']

describe('quarter CSV import parser', () => {
  it('retains values when header cells include surrounding whitespace', () => {
    const paddedHeaders = headers.map(header => ` ${header} `)
    const row = Object.fromEntries(paddedHeaders.map(header => [header, '']))
    row[` ${fixedHeaders[1]} `] = 'Padded student'
    row[` ${fixedHeaders[3]} `] = '1960/7/17'
    row[` ${headers.at(-7)} `] = '2026/03/05'
    row[` ${headers.at(-6)} `] = '2026/03/06'
    row[` ${headers.at(-4)} `] = 'Padded course'

    const parsed = parseQuarterCsvRows([row], { headers: paddedHeaders, today: new Date('2026-07-16') })

    expect(parsed.errors).toEqual([])
    expect(parsed.rows[0].student).toMatchObject({ name: 'Padded student', birth_date: '1960/07/17' })
    expect(parsed.rows[0].enrollments[0]).toMatchObject({
      pre_test: '2026/03/05',
      post_test: '2026/03/06',
      courses: ['Padded course']
    })
  })

  it('normalizes real dates and recalculates age', () => {
    expect(normalizeCsvDate('2026-3-5')).toBeNull()
    expect(normalizeCsvDate('2026/3/5')).toBe('2026/03/05')
    expect(normalizeCsvDate('2026-03-05')).toBe('2026/03/05')
    expect(normalizeCsvDate('2026/02/30')).toBeNull()

    const parsed = parseQuarterCsvRows([{ 姓名: '王小明', 出生日期: '1960/7/17', '第16季前測': '2026-3-5', '第16季後測': '', '第16季(新、續)': '新', 課程1: '肌力', 課程2: ' 肌力 ' }], { headers, today: new Date('2026-07-16') })
    expect(parsed.seasons).toEqual(['第十六季'])
    expect(parsed.rows[0].student).toMatchObject({ birth_date: '1960/07/17', age: 65, is_60_plus: '是' })
    expect(parsed.rows[0].enrollments[0]).toMatchObject({ pre_test: null, post_test: null, reg_type: '新', courses: ['肌力'] })
    expect(parsed.errors).toContainEqual({ row: 2, field: '第16季前測', message: '日期格式無法辨識' })
  })

  it('accepts reordered headers and unbounded contiguous course columns', () => {
    const dynamicHeaders = [...fixedHeaders.slice().reverse(), '課程4', '第十六季後測', '課程2', '第十六季(新、續)', '課程1', '第十六季前測', '課程3']
    const parsed = parseQuarterCsvRows([{ 姓名: '陳美麗', 課程1: '攝影', 課程4: '陶笛' }], { headers: dynamicHeaders })
    expect(parsed.errors).toEqual([])
    expect(parsed.rows[0].enrollments[0].courses).toEqual(['攝影', '陶笛'])
  })

  it('blocks missing headers, course gaps, invalid registration values, and multiple quarters', () => {
    const parsed = parseQuarterCsvRows([{ 姓名: '王小明', '第16季(新、續)': '舊' }], {
      headers: [...fixedHeaders.filter(header => header !== '職業'), '第16季前測', '第17季後測', '第16季(新、續)', '課程0', '課程1', '課程3']
    })
    expect(parsed.errors.map(error => error.message)).toEqual(expect.arrayContaining([
      '缺少必要欄位：職業', '偵測到多個季度，功能尚未開發', '課程欄位必須從課程1開始', '缺少課程2', '只允許填寫新、續或空白'
    ]))
  })

  it('validates every registration column when multiple quarters block enrollment creation', () => {
    const parsed = parseQuarterCsvRows([{
      姓名: '王小明',
      '第16季(新、續)': '舊',
      '第17季(新、續)': '舊'
    }], {
      headers: [...fixedHeaders,
        '第16季前測', '第16季後測', '第16季(新、續)',
        '第17季前測', '第17季後測', '第17季(新、續)',
        '課程1'
      ]
    })

    expect(parsed.seasons).toEqual([])
    expect(parsed.rows[0].enrollments).toEqual([])
    expect(parsed.errors).toContainEqual({ row: null, field: '季度', message: '偵測到多個季度，功能尚未開發' })
    expect(parsed.errors.filter(error => error.message === '只允許填寫新、續或空白')).toEqual([
      { row: 2, field: '第16季(新、續)', message: '只允許填寫新、續或空白' },
      { row: 2, field: '第17季(新、續)', message: '只允許填寫新、續或空白' }
    ])
  })

  it('blocks duplicate IDs and duplicate blank-ID identities in one file', () => {
    const rows = [
      { 學員編號: '12', 姓名: '甲', '第16季前測': '', '第16季後測': '', '第16季(新、續)': '', 課程1: '' },
      { 學員編號: '12', 姓名: '甲', '第16季前測': '', '第16季後測': '', '第16季(新、續)': '', 課程1: '' },
      { 學員編號: '', 姓名: '乙', 出生日期: '1962/2/2', 手機電話: '0933-000-000', '第16季前測': '', '第16季後測': '', '第16季(新、續)': '', 課程1: '' },
      { 學員編號: '', 姓名: ' 乙 ', 出生日期: '1962-02-02', 手機電話: '0933000000', '第16季前測': '', '第16季後測': '', '第16季(新、續)': '', 課程1: '' }
    ]
    const parsed = parseQuarterCsvRows(rows, { headers: [...fixedHeaders, '第16季前測', '第16季後測', '第16季(新、續)', '課程1'] })
    expect(parsed.errors.filter(error => error.field === '學員編號')).toHaveLength(2)
  })
})
