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

  it('blocks suspected duplicate blank-ID students within the imported file', () => {
    const parsed = {
      rows: [
        row(null, '新學生', '1962-02-02', '0933-000-000'),
        { ...row(null, '新學生', '1962-02-02', '0933000000'), source_row: 3 }
      ],
      warnings: [], errors: []
    }

    const preview = classifyImport(parsed, {
      students: [], enrollments: [], tableCounts: { students: 0, enrollments: 0, courses: 0 }
    })

    expect(preview.hasBlockingErrors).toBe(true)
    expect(preview.errors).toHaveLength(1)
    expect(preview.errors[0]).toMatchObject({ row: 3, field: '學員編號' })
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
    const orders = []
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
              order(column) {
                orders.push({ table, column })
                return this
              },
              range(from, to) {
                calls.push({ table, from, to })
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
      { table: 'students', columns: '*', options: undefined }, { table: 'students', from: 0, to: 999 },
      { table: 'enrollments', columns: 'enrollment_id, student_id, season', options: undefined }, { table: 'enrollments', from: 0, to: 999 },
      { table: 'students', columns: '*', options: { count: 'exact', head: true } },
      { table: 'enrollments', columns: '*', options: { count: 'exact', head: true } },
      { table: 'courses', columns: '*', options: { count: 'exact', head: true } }
    ])
    expect(orders).toEqual([
      { table: 'students', column: 'student_id' },
      { table: 'enrollments', column: 'enrollment_id' }
    ])
  })

  it('collects every student and enrollment page before classifying the import', async () => {
    const ranges = []
    const orders = []
    const firstStudentPage = Array.from({ length: 1000 }, (_, index) => ({ student_id: String(index + 100), name: `既有學生${index}`, birth_date: null, mobile_phone: null }))
    firstStudentPage[0] = { student_id: '12', name: '王小明', birth_date: '1960-01-01', mobile_phone: null }
    const firstEnrollmentPage = Array.from({ length: 1000 }, (_, index) => ({ student_id: String(index + 100), season: '第十六季' }))
    firstEnrollmentPage[0] = { student_id: '12', season: '第十六季' }
    const pages = {
      students: {
        0: firstStudentPage,
        1000: [{ student_id: '13', name: '王小華', birth_date: '1961-01-01', mobile_phone: null }]
      },
      enrollments: {
        0: firstEnrollmentPage,
        1000: [{ student_id: '13', season: '第十六季' }]
      }
    }
    const client = {
      from(table) {
        return {
          select(columns, options) {
            if (options?.head) return Promise.resolve({ count: table === 'courses' ? 0 : 2, error: null })
            return {
              limit() {
                return Promise.resolve({ data: pages[table][0], error: null })
              },
              order(column) {
                orders.push({ table, column })
                return this
              },
              range(from, to) {
                ranges.push({ table, from, to })
                return Promise.resolve({ data: pages[table][from], error: null })
              }
            }
          }
        }
      }
    }

    const preview = await loadImportPreview(client, {
      mode: 'single-season',
      rows: [row('12', '王小明', '1960-01-01'), { ...row('13', '王小華', '1961-01-01'), source_row: 3 }],
      warnings: [], errors: []
    })

    expect(preview.summary).toMatchObject({ oldStudents: 2, enrollmentsToUpdate: 2, currentStudents: 2, currentEnrollments: 2 })
    expect(ranges).toEqual([
      { table: 'students', from: 0, to: 999 }, { table: 'enrollments', from: 0, to: 999 },
      { table: 'students', from: 1000, to: 1999 }, { table: 'enrollments', from: 1000, to: 1999 }
    ])
    expect(orders).toEqual([
      { table: 'students', column: 'student_id' }, { table: 'enrollments', column: 'enrollment_id' },
      { table: 'students', column: 'student_id' }, { table: 'enrollments', column: 'enrollment_id' }
    ])
  })
})
