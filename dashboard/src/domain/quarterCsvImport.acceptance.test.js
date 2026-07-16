import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { parseQuarterCsvRows } from './quarterCsvImport'

describe('quarter CSV acceptance', () => {
  it('converts the approved real CSV fixture', () => {
    const csv = fs.readFileSync(path.resolve(process.cwd(), 'src/fixtures/quarter-import-sample.csv'), 'utf8')
    const workbook = XLSX.read(csv, { type: 'string', raw: true })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const headers = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true })[0]
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true })
    const parsed = parseQuarterCsvRows(rows, { headers, today: new Date('2026-07-16') })
    expect(parsed.errors).toEqual([])
    expect(parsed.seasons).toEqual(['第十六季'])
    expect(parsed.rows[0].student).toMatchObject({ birth_date: '1960/07/17', age: 65, is_60_plus: '是' })
    expect(parsed.rows[0].enrollments[0]).toEqual({ season: '第十六季', reg_type: '新', pre_test: '2026/03/05', post_test: null, courses: ['肌力', '攝影', '陶笛'] })
  })
})
