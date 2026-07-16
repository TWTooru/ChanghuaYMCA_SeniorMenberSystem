import { describe, expect, it } from 'vitest'
import { classifyImport, loadImportPreview } from './importPreviewService'

const row = (id, name, birth, mobile = null) => ({
  source_row: 2,
  provided_student_id: id,
  student: { name, birth_date: birth, mobile_phone: mobile },
  enrollments: [{ season: '第十六季', reg_type: '續', pre_test: null, post_test: null, courses: ['肌力'] }]
})

describe('classifyImport', () => {
  it('classifies old and new students plus enrollment inserts and updates', () => {
    const parsed = { rows: [row('12', '王小明', '1960-01-01'), row(null, '陳美麗', '1962-02-02')], warnings: [], errors: [] }
    const preview = classifyImport(parsed, {
      students: [{ student_id: '12', name: '王小明', birth_date: '1960-01-01', mobile_phone: null }],
      enrollments: [{ student_id: '12', season: '第十六季' }],
      tableCounts: { students: 398, enrollments: 1090, courses: 1191 }
    })
    expect(preview.summary).toMatchObject({ oldStudents: 1, newStudents: 1, enrollmentsToInsert: 1, enrollmentsToUpdate: 1, courses: 2 })
  })

  it('blocks nonexistent old IDs and suspected duplicate new students', () => {
    const parsed = { rows: [row('999', '不存在', '1960-01-01'), row(null, '王小明', '1960-01-01')], warnings: [], errors: [] }
    const preview = classifyImport(parsed, {
      students: [{ student_id: '12', name: '王小明', birth_date: '1960-01-01', mobile_phone: null }],
      enrollments: [], tableCounts: { students: 1, enrollments: 0, courses: 0 }
    })
    expect(preview.hasBlockingErrors).toBe(true)
    expect(preview.errors).toHaveLength(2)
  })

  it('allows missing supplied IDs only for historical restoration', () => {
    const parsed = { mode: 'legacy-total', rows: [row('1', '歷史學生', '1960-01-01')], warnings: [], errors: [] }
    const preview = classifyImport(parsed, { students: [], enrollments: [], tableCounts: { students: 0, enrollments: 0, courses: 0 } })
    expect(preview.hasBlockingErrors).toBe(false)
    expect(preview.summary.newStudents).toBe(1)
    expect(preview.payload.mode).toBe('legacy-total')
  })

  it('warns when the imported season already has an enrollment for another student', () => {
    const parsed = { mode: 'single-season', rows: [row('13', '新季度學生', '1961-01-01')], warnings: [], errors: [] }
    const preview = classifyImport(parsed, {
      students: [{ student_id: '13', name: '新季度學生', birth_date: '1961-01-01', mobile_phone: null }],
      enrollments: [{ student_id: '12', season: '第十六季' }],
      tableCounts: { students: 1, enrollments: 1, courses: 0 }
    })

    expect(preview.summary.enrollmentsToUpdate).toBe(0)
    expect(preview.warnings).toContainEqual({ row: null, field: '報名', message: '目標季度已有資料，本次會更新並取代課程' })
  })

  it('loads a read-only snapshot before classifying', async () => {
    const calls = []
    const results = {
      students: { data: [{ student_id: '12', name: '王小明', birth_date: '1960-01-01', mobile_phone: null }], error: null },
      enrollments: { data: [{ student_id: '12', season: '第十六季' }], error: null },
      courses: { count: 1, error: null }
    }
    const client = {
      from(table) {
        return {
          select(columns, options) {
            calls.push({ table, columns, options })
            if (options?.head) return Promise.resolve({ count: table === 'students' ? 1 : table === 'enrollments' ? 1 : 1, error: null })
            return {
              limit(limit) {
                calls.push({ table, limit })
                return Promise.resolve(results[table])
              }
            }
          }
        }
      }
    }

    const preview = await loadImportPreview(client, { mode: 'single-season', rows: [row('12', '王小明', '1960-01-01')], warnings: [], errors: [] })

    expect(preview.summary).toMatchObject({ oldStudents: 1, enrollmentsToUpdate: 1, currentStudents: 1, currentEnrollments: 1, currentCourses: 1 })
    expect(calls).toEqual([
      { table: 'students', columns: '*', options: undefined }, { table: 'students', limit: 9999 },
      { table: 'enrollments', columns: 'student_id, season', options: undefined }, { table: 'enrollments', limit: 9999 },
      { table: 'students', columns: '*', options: { count: 'exact', head: true } },
      { table: 'enrollments', columns: '*', options: { count: 'exact', head: true } },
      { table: 'courses', columns: '*', options: { count: 'exact', head: true } }
    ])
  })
})
