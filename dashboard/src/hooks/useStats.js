import { useMemo } from 'react'
import { normalizeEducation } from '../domain/studentFields'

/**
 * 從目前學員與報名快照計算純顯示統計，不讀寫遠端資料。
 * 回傳物件供 overview 卡片與圖表共用，避免各元件重複定義分組規則。
 */
export default function useStats(students, enrollments) {
  return useMemo(() => {
    if (!students || students.length === 0) {
      return {
        totalStudents: 0, totalRegistrations: 0, totalRefunds: 0,
        males: 0, females: 0, ageGroups: {}, eduCounts: {}, popularCourses: []
      }
    }
    const totalStudents = students.length
    const totalRegistrations = enrollments.length
    const totalRefunds = enrollments.filter(e => e.refunded).length
    const males = students.filter(s => s.gender === '男').length
    const females = students.filter(s => s.gender === '女').length

    const ageGroups = {
      '50歲以下': 0, '50-59歲': 0, '60-69歲': 0, '70-79歲': 0, '80歲以上': 0, '未知': 0
    }
    students.forEach(s => {
      const age = s.age
      if (!age) ageGroups['未知']++
      else if (age < 50) ageGroups['50歲以下']++
      else if (age >= 50 && age < 60) ageGroups['50-59歲']++
      else if (age >= 60 && age < 70) ageGroups['60-69歲']++
      else if (age >= 70 && age < 80) ageGroups['70-79歲']++
      else ageGroups['80歲以上']++
    })

    const eduCounts = {}
    students.forEach(s => {
      const cleanEdu = normalizeEducation(s.education)
      eduCounts[cleanEdu] = (eduCounts[cleanEdu] || 0) + 1
    })

    const courseCounts = {}
    enrollments.forEach(e => {
      if (!e.refunded) {
        e.courses.forEach(c => {
          courseCounts[c] = (courseCounts[c] || 0) + 1
        })
      }
    })

    const popularCourses = Object.entries(courseCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)

    return {
      totalStudents, totalRegistrations, totalRefunds,
      males, females, ageGroups, eduCounts, popularCourses
    }
  }, [students, enrollments])
}
