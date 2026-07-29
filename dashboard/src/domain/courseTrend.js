import { compareSeasons } from './season'

/**
 * 將學生未退款的報名時間軸彙整為各課程的修課次數，
 * 並在每個季別或報名資料內去除重複課程。
 */
export function buildStudentCourseTrend(timeline = []) {
  const trendsByCourse = new Map()

  for (const [index, enrollment] of Array.from(timeline || []).entries()) {
    if (!enrollment || enrollment.refunded) continue

    const season = String(enrollment.season ?? '').trim()
    const enrollmentKey = enrollment.enrollment_id ?? index
    const occurrenceKey = season ? `season:${season}` : `enrollment:${enrollmentKey}`
    const courseNames = new Set(
      (Array.isArray(enrollment.courses) ? enrollment.courses : [])
        .map(course => String(course ?? '').trim())
        .filter(Boolean)
    )

    for (const courseName of courseNames) {
      if (!trendsByCourse.has(courseName)) {
        trendsByCourse.set(courseName, {
          courseName,
          occurrences: new Set(),
          seasons: new Set(),
        })
      }

      const trend = trendsByCourse.get(courseName)
      trend.occurrences.add(occurrenceKey)
      if (season) trend.seasons.add(season)
    }
  }

  const rows = Array.from(trendsByCourse.values())
    .map(trend => ({
      courseName: trend.courseName,
      count: trend.occurrences.size,
      seasons: Array.from(trend.seasons).sort(compareSeasons),
    }))
    .sort((left, right) => right.count - left.count || left.courseName.localeCompare(right.courseName, 'zh-Hant'))

  const maxCount = Math.max(0, ...rows.map(row => row.count))
  return rows.map(row => ({
    ...row,
    percentage: maxCount ? Math.round((row.count / maxCount) * 100) : 0,
  }))
}
