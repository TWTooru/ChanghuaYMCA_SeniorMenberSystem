import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { parseTabularRows } from './seasonImport'

describe('legacy total import acceptance', () => {
  it('converts the current total CSV to the approved counts', () => {
    const workbook = XLSX.read(fs.readFileSync('../data/總表.csv'), { type: 'buffer' })
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: null, raw: true })
    const parsed = parseTabularRows(rows, { today: new Date('2026-07-16') })
    const enrollments = parsed.rows.flatMap(row => row.enrollments)
    const courses = enrollments.flatMap(enrollment => enrollment.courses)

    expect(parsed.errors).toEqual([])
    expect(parsed.rows).toHaveLength(398)
    expect(enrollments).toHaveLength(1090)
    expect(courses).toHaveLength(1191)
    expect(enrollments.every(enrollment => enrollment.season.endsWith('季'))).toBe(true)
  })
})
