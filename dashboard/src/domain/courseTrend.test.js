import { describe, expect, it } from 'vitest'
import { buildStudentCourseTrend } from './courseTrend'

describe('buildStudentCourseTrend', () => {
  it('counts each course once per season and lists seasons chronologically', () => {
    const result = buildStudentCourseTrend([
      { enrollment_id: 1, season: '第十五季', refunded: false, courses: ['電腦課', '電腦課', '手機課'] },
      { enrollment_id: 2, season: '第十六季', refunded: false, courses: ['電腦課'] },
      { enrollment_id: 3, season: '第十六季', refunded: false, courses: ['電腦課'] },
    ])

    expect(result).toEqual([
      { courseName: '電腦課', count: 2, seasons: ['第十五季', '第十六季'], percentage: 100 },
      { courseName: '手機課', count: 1, seasons: ['第十五季'], percentage: 50 },
    ])
  })

  it('excludes refunded records and safely handles blank courses and missing seasons', () => {
    const result = buildStudentCourseTrend([
      { enrollment_id: 1, season: null, refunded: false, courses: [' 手機課 ', '   '] },
      { enrollment_id: 2, season: null, refunded: false, courses: ['手機課'] },
      { enrollment_id: 3, season: '第十七季', refunded: true, courses: ['手機課', '瑜伽課'] },
      { enrollment_id: 4, season: '第十八季', refunded: false },
    ])

    expect(result).toEqual([
      { courseName: '手機課', count: 2, seasons: [], percentage: 100 },
    ])
  })

  it('sorts equal counts by course name', () => {
    const result = buildStudentCourseTrend([
      { enrollment_id: 1, season: '第十五季', courses: ['B課', 'A課'] },
    ])

    expect(result.map(item => item.courseName)).toEqual(['A課', 'B課'])
  })
})
