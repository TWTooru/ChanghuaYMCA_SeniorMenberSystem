import { useCallback } from 'react'
import { exportToExcel } from '../lib/excelExport'

/**
 * 將匯出對話框的季度與工作表選項套用到目前快照，
 * 再交由 `exportToExcel` 建立 workbook；此 hook 不重新查詢 Supabase。
 */
export default function useExportHandler(students, enrollments) {
  return useCallback(({ exportScope, selectedSeason, options }) => {
    let exportStudents = students
    let exportEnrollments = enrollments

    if (exportScope === 'season') {
      exportEnrollments = enrollments.filter(e => e.season === selectedSeason)
      const enrolledIds = new Set(exportEnrollments.map(e => String(e.student_id)))
      exportStudents = students.filter(s => enrolledIds.has(String(s.student_id)))
    }

    const courseCounts = {}
    exportEnrollments.forEach(e => {
      if (!e.refunded) {
        e.courses.forEach(c => {
          courseCounts[c] = (courseCounts[c] || 0) + 1
        })
      }
    })
    const exportCourses = Object.entries(courseCounts)
      .map(([name, count]) => ({ Course: name, Count: count }))
      .sort((a, b) => b.Count - a.Count)

    const filename = exportScope === 'season' ? `YMCA_export_${selectedSeason}.xlsx` : 'YMCA_export_all.xlsx'

    exportToExcel(exportStudents, exportEnrollments, exportCourses, filename, options)
  }, [students, enrollments])
}
