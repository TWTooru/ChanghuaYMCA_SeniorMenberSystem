import { useState, useEffect, useCallback } from 'react'

/**
 * 以穩定的 `student_id` 保存選取狀態，並在資料刷新後替換為最新物件。
 * 同時集中管理學員明細的初始頁籤與是否顯示頁籤介面。
 */
export default function useStudentSelection(students) {
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [studentDetailInitialTab, setStudentDetailInitialTab] = useState('profile')
  const [studentDetailIsTabbed, setStudentDetailIsTabbed] = useState(true)

  const openStudentDetail = useCallback((student, initialTab = null) => {
    if (initialTab) {
      setStudentDetailInitialTab(initialTab)
      setStudentDetailIsTabbed(true)
    } else {
      setStudentDetailInitialTab(null)
      setStudentDetailIsTabbed(false)
    }
    setSelectedStudent(student)
  }, [])

  const closeStudentDetail = useCallback(() => {
    setSelectedStudent(null)
  }, [])

  const replaceSelectedStudent = useCallback(updatedStudent => {
    setSelectedStudent(updatedStudent)
  }, [])

  useEffect(() => {
    setSelectedStudent(current => {
      if (!current) return current
      return (students || []).find(candidate => String(candidate.student_id) === String(current.student_id)) || current
    })
  }, [students])

  return {
    selectedStudent,
    studentDetailInitialTab,
    studentDetailIsTabbed,
    openStudentDetail,
    closeStudentDetail,
    replaceSelectedStudent,
  }
}
