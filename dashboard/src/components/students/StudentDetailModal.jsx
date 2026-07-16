import { useEffect, useMemo, useRef, useState } from 'react'
import { Edit2, Trash2, X } from 'lucide-react'
import ConfirmDialog from '../common/ConfirmDialog'
import EnrollmentTimeline from '../enrollment/EnrollmentTimeline'
import { supabase } from '../../lib/supabaseClient'
import StudentEditForm from './StudentEditForm'
import StudentInfoView from './StudentInfoView'
import { getEnrollmentsForStudent } from '../../domain/studentRelations'
import { compareSeasons } from '../../domain/season'
import { useAuth } from '../../contexts/AuthContext'
import usePermissions from '../../hooks/usePermissions'

function getFocusableElements(container) {
  return Array.from(container?.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') || [])
    .filter(element => !element.hasAttribute('disabled'))
}

export default function StudentDetailModal({ student, enrollments, initialTab = 'history', onClose, onAddEnrollment, onRefresh }) {
  const { role } = useAuth()
  const permissions = usePermissions(role)
  const [isEditing, setIsEditing] = useState(false)
  const [activeDetailTab, setActiveDetailTab] = useState(initialTab)
  const [isStudentDeleteConfirmOpen, setShowDeleteConfirm] = useState(false)
  const [pendingDeleteEnrollmentId, setShowDeleteEnrollConfirm] = useState(null)
  const dialogRef = useRef(null)
  const previousFocusRef = useRef(null)
  const showDeleteConfirm = isStudentDeleteConfirmOpen && permissions.canDeleteStudent
  const showDeleteEnrollConfirm = permissions.canDeleteEnrollment ? pendingDeleteEnrollmentId : null

  useEffect(() => {
    if (!permissions.canEditStudent) setIsEditing(false)
    if (!permissions.canDeleteStudent) setShowDeleteConfirm(false)
    if (!permissions.canDeleteEnrollment) setShowDeleteEnrollConfirm(null)
  }, [permissions.canDeleteEnrollment, permissions.canDeleteStudent, permissions.canEditStudent])

  useEffect(() => {
    setActiveDetailTab(initialTab)
    setIsEditing(false)
  }, [student?.student_id, initialTab])

  useEffect(() => {
    previousFocusRef.current = document.activeElement
    const dialog = dialogRef.current
    if (!dialog) return undefined
    const [initialFocus] = getFocusableElements(dialog)
    ;(initialFocus || dialog).focus()

    return () => {
      const previousFocus = previousFocusRef.current
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [])

  const studentTimeline = useMemo(() => {
    if (!student || !enrollments) return []
    return getEnrollmentsForStudent(enrollments, student.student_id)
      .sort((a, b) => compareSeasons(a.season, b.season))
  }, [student, enrollments])

  if (!student) return null

  const handleDeleteStudent = async () => {
    if (!permissions.canDeleteStudent) {
      setShowDeleteConfirm(false)
      return
    }

    try {
      const { data: enrolls } = await supabase.from('enrollments').select('enrollment_id').eq('student_id', student.student_id)
      if (enrolls && enrolls.length > 0) await supabase.from('courses').delete().in('enrollment_id', enrolls.map(enrollment => enrollment.enrollment_id))
      await supabase.from('enrollments').delete().eq('student_id', student.student_id)
      const { error } = await supabase.from('students').delete().eq('student_id', student.student_id)
      if (error) throw error
      alert('學員已刪除')
      if (onRefresh) onRefresh()
      onClose()
    } catch (err) {
      alert('伺服器錯誤: ' + err.message)
    }
  }

  const handleDeleteEnrollment = async (enrollmentId) => {
    if (!permissions.canDeleteEnrollment) {
      setShowDeleteEnrollConfirm(null)
      return
    }

    try {
      await supabase.from('courses').delete().eq('enrollment_id', enrollmentId)
      const { error } = await supabase.from('enrollments').delete().eq('enrollment_id', enrollmentId)
      if (error) throw error
      alert('選課紀錄已刪除')
      if (onRefresh) onRefresh()
      setShowDeleteEnrollConfirm(null)
    } catch (err) {
      alert('伺服器錯誤: ' + err.message)
    }
  }

  const handleKeyDown = event => {
    if (event.key === 'Escape') {
      onClose()
      return
    }
    if (event.key !== 'Tab') return

    const dialog = dialogRef.current
    const focusableElements = getFocusableElements(dialog)
    if (focusableElements.length === 0) {
      event.preventDefault()
      dialog.focus()
      return
    }

    const first = focusableElements[0]
    const last = focusableElements[focusableElements.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const deleteStudentMessage = `確定要刪除學員「${student.name}」（${student.student_id}）嗎？此操作無法復原，該學員的所有選課紀錄也會一併刪除。`

  return (
    <>
      <div className="modal-overlay student-detail-overlay" onClick={onClose} id="modal-overlay">
        <div className="modal-content student-detail-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="student-detail-title" tabIndex={-1} onClick={event => event.stopPropagation()} onKeyDown={handleKeyDown}>
          <div className="modal-header student-detail-header">
          <div className="modal-title-group"><span className="modal-id-badge">{student.student_id}</span><h2 id="student-detail-title" className="modal-name">{student.name} ({student.gender || '未知'})</h2></div>
          <div className="modal-header-actions">
            {activeDetailTab === 'profile' && !isEditing && permissions.canEditStudent && <button type="button" className="btn-edit" onClick={() => setIsEditing(true)}><Edit2 size={14} /> 編輯</button>}
            {permissions.canDeleteStudent && <button type="button" className="btn-delete" onClick={() => setShowDeleteConfirm(true)}><Trash2 size={14} /> 刪除</button>}
            <button type="button" className="btn-close" onClick={onClose} id="btn-close-modal" aria-label="關閉學員資料"><X size={20} /></button>
          </div>
        </div>
        <div className="student-detail-tabs" role="tablist" aria-label="學員資料夾">
          <button type="button" role="tab" aria-selected={activeDetailTab === 'profile'} onClick={() => setActiveDetailTab('profile')}>基本資料</button>
          <button type="button" role="tab" aria-selected={activeDetailTab === 'history'} onClick={() => setActiveDetailTab('history')}>歷年參修（{studentTimeline.length} 期）</button>
        </div>
        <div className="modal-body student-detail-body">
          {activeDetailTab === 'profile' ? (
            <section role="tabpanel" aria-label="基本資料">
              {isEditing
                ? <StudentEditForm student={student} onSave={() => { setIsEditing(false); onRefresh?.() }} onCancel={() => setIsEditing(false)} />
                : <StudentInfoView student={student} />}
            </section>
          ) : (
            <section role="tabpanel" aria-label="歷年參修">
              <EnrollmentTimeline
                timeline={studentTimeline}
                onDelete={permissions.canDeleteEnrollment ? setShowDeleteEnrollConfirm : null}
                onAddEnrollment={permissions.canAddEnrollment ? onAddEnrollment : null}
                onEditEnrollment={permissions.canEditEnrollment}
                onRefresh={onRefresh}
              />
            </section>
          )}
        </div>
      </div>
      </div>
      <ConfirmDialog isOpen={showDeleteConfirm} title="刪除學員" message={deleteStudentMessage} onConfirm={handleDeleteStudent} onCancel={() => setShowDeleteConfirm(false)} />
      <ConfirmDialog isOpen={showDeleteEnrollConfirm !== null} title="刪除選課紀錄" message="確定要刪除此選課紀錄嗎？此操作無法復原。" onConfirm={() => handleDeleteEnrollment(showDeleteEnrollConfirm)} onCancel={() => setShowDeleteEnrollConfirm(null)} />
    </>
  )
}
