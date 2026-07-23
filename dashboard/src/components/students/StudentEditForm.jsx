import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { updateStudent } from '../../services/studentService'
import ConfirmDialog from '../common/ConfirmDialog'
import { STUDENT_ID_VALIDATION_MESSAGE, normalizeStudentId } from '../../domain/studentIdentity'

const fields = [
  ['name', '姓名'], ['mobile_phone', '手機電話'], ['home_phone', '家裡電話'], ['address', '地址'],
  ['emergency_contact', '緊急聯絡人'], ['relationship', '關係'], ['emergency_contact_phone', '緊急聯絡人電話'],
  ['education', '教育程度'], ['occupation', '職業'],
]

export default function StudentEditForm({ student, onSave, onCancel, onDirtyChange = () => {} }) {
  const initialForm = useMemo(() => ({ ...student }), [student])
  const [editForm, setEditForm] = useState(initialForm)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [pendingPayload, setPendingPayload] = useState(null)
  const isDirty = JSON.stringify(editForm) !== JSON.stringify(initialForm)

  useEffect(() => { onDirtyChange(isDirty); return () => onDirtyChange(false) }, [isDirty, onDirtyChange])
  const change = event => setEditForm(current => ({ ...current, [event.target.name]: event.target.value }))
  const buildPayload = () => {
    const originalId = String(student.student_id)
    const typedId = String(editForm.student_id ?? '').trim()
    return {
      student_id: typedId === originalId ? originalId : normalizeStudentId(typedId),
      ...Object.fromEntries(fields.map(([key]) => [key, String(editForm[key] ?? '').trim()])),
      gender: editForm.gender || '', birth_date: editForm.birth_date || '',
    }
  }
  const persist = async payload => {
    setIsSaving(true); setSaveError('')
    try {
      const updated = await updateStudent(supabase, student.student_id, payload)
      setPendingPayload(null); onDirtyChange(false); onSave(updated)
    } catch (error) { setSaveError(error.message || '學生資料更新失敗') } finally { setIsSaving(false) }
  }
  const save = () => {
    try {
      setSaveError(''); const payload = buildPayload()
      if (payload.student_id !== String(student.student_id)) setPendingPayload(payload)
      else void persist(payload)
    } catch { setSaveError(STUDENT_ID_VALIDATION_MESSAGE) }
  }
  return <>
    <div className="form-grid" style={{ padding: 0, background: 'transparent' }}>
      <h3 className="student-edit-section-title">基本資料</h3>
      <div className="form-group"><label className="form-label" htmlFor="student-edit-id">學員編號</label><input id="student-edit-id" className="form-input" name="student_id" inputMode="numeric" value={editForm.student_id || ''} onChange={change} disabled={isSaving} /><small>僅可輸入大於 0 的整數；變更後會同步所有報名資料。</small></div>
      {fields.map(([key, label]) => <div className="form-group" key={key}><label className="form-label">{label}</label><input className="form-input" name={key} value={editForm[key] || ''} onChange={change} disabled={isSaving} /></div>)}
      <div className="form-group"><label className="form-label">性別</label><select className="form-select" name="gender" value={editForm.gender || ''} onChange={change} disabled={isSaving}><option value="">請選擇</option><option value="男">男</option><option value="女">女</option></select></div>
      <div className="form-group"><label className="form-label">出生日期</label><input type="date" className="form-input" name="birth_date" value={editForm.birth_date || ''} onChange={change} disabled={isSaving} /></div>
      <div className="form-group"><label className="form-label">年齡</label><input className="form-input" value={editForm.age || ''} readOnly disabled={isSaving} /></div>
      <div className="form-group"><label className="form-label">是否滿 60 歲</label><input className="form-input" value={editForm.is_60_plus || ''} readOnly disabled={isSaving} /></div>
      {saveError && <p className="student-edit-error" role="alert">{saveError}</p>}
      <div className="form-group full-width student-edit-actions"><button type="button" className="btn-secondary" onClick={onCancel} disabled={isSaving}>取消</button><button type="button" className="btn-primary" onClick={save} disabled={isSaving}>{isSaving ? '儲存中…' : '儲存變更'}</button></div>
    </div>
    <ConfirmDialog isOpen={pendingPayload !== null} title="確認變更學員編號" message="變更學員編號會同步更新所有相關報名資料。" confirmLabel="確認變更" cancelLabel="取消" tone="warning" onConfirm={() => void persist(pendingPayload)} onCancel={() => setPendingPayload(null)} />
  </>
}
