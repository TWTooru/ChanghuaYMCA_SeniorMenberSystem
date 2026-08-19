import { useMemo } from 'react'
import { EDUCATION_OPTIONS, normalizeEducation } from '../domain/studentFields'
import { comparePeriods, latestPeriod } from '../domain/period'

export default function useStats(students = [], enrollments = []) {
  return useMemo(() => {
    const education = Object.fromEntries(EDUCATION_OPTIONS.map(label => [label, 0]))
    const gender = { 男: 0, 女: 0 }
    for (const student of students) {
      const educationValue = normalizeEducation(student.education)
      if (educationValue) education[educationValue] += 1
      if (student.gender === '男' || student.gender === '女') gender[student.gender] += 1
    }

    const groups = new Map()
    for (const enrollment of enrollments) {
      if (!enrollment.period) continue
      const group = groups.get(enrollment.period) ?? { period: enrollment.period, enrollments: 0, refunds: 0, studentIds: new Set(), courses: 0, revenue: 0, prepaid: 0 }
      group.enrollments += 1
      group.refunds += enrollment.refunded ? 1 : 0
      if (enrollment.student_id != null) group.studentIds.add(enrollment.student_id)
      if (!enrollment.refunded) {
        group.courses += enrollment.courses?.length ?? 0
        const fees = (enrollment.tuition_fee || 0) + (enrollment.materials_fee || 0) + (enrollment.membership_fee || 0)
        group.revenue += fees
        group.prepaid += (enrollment.prepaid_amount || 0)
      }
      groups.set(enrollment.period, group)
    }
    const periodStats = [...groups.values()].map(group => ({
      period: group.period, enrollments: group.enrollments, refunds: group.refunds,
      uniqueStudents: group.studentIds.size, courses: group.courses,
      avgCoursesPerStudent: group.studentIds.size ? group.courses / group.studentIds.size : 0,
      revenue: group.revenue ?? 0,
      prepaid: group.prepaid ?? 0,
    })).sort((a, b) => comparePeriods(a.period, b.period))
    const currentPeriod = latestPeriod(groups.keys())
    const currentIndex = periodStats.findIndex(stat => stat.period === currentPeriod)
    const currentPeriodStats = currentIndex >= 0 ? periodStats[currentIndex] : null

    return {
      totalStudents: students.length,
      totalRegistrations: enrollments.length,
      totalRefunds: enrollments.filter(enrollment => enrollment.refunded).length,
      totalRevenue: periodStats.reduce((sum, p) => sum + p.revenue, 0),
      totalPrepaid: periodStats.reduce((sum, p) => sum + p.prepaid, 0),
      males: gender.男,
      females: gender.女,
      educationCounts: EDUCATION_OPTIONS.map(label => ({ label, value: education[label] })),
      genderCounts: [{ label: '男', value: gender.男 }, { label: '女', value: gender.女 }],
      periodStats,
      currentPeriod,
      currentPeriodStats,
      previousPeriodStats: currentIndex > 0 ? periodStats[currentIndex - 1] : null,
    }
  }, [students, enrollments])
}
