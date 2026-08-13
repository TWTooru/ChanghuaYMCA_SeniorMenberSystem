import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { EDUCATION_OPTIONS } from '../../domain/studentFields'
import { normalizeStudentId, STUDENT_ID_VALIDATION_MESSAGE } from '../../domain/studentIdentity'
import { updateStudent } from '../../services/studentService'
import ConfirmDialog from '../common/ConfirmDialog'

const profileKeys = ['email', 'name', 'gender', 'phone', 'birth_date', 'address', 'organization', 'education']
const optionalKeys = ['email', 'phone', 'birth_date', 'address', 'organization']

export default function StudentEditForm({ student, onSave, onCancel, onDirtyChange = () => {} }) {
  const initialForm = useMemo(() => Object.fromEntries(['student_id', ...profileKeys].map(key => [key, student?.[key] ?? ''])), [student])
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState('')
  const [pendingPayload, setPendingPayload] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm)

  useEffect(() => { onDirtyChange(isDirty); return () => onDirtyChange(false) }, [isDirty, onDirtyChange])
  const change = event => setForm(value => ({ ...value, [event.target.name]: event.target.value }))
  const buildPayload = () => {
    const studentId = normalizeStudentId(form.student_id)
    const payload = Object.fromEntries(profileKeys.map(key => [key, String(form[key] ?? '').trim()]))
    payload.student_id = studentId
    payload.email = payload.email.toLowerCase()
    for (const key of optionalKeys) payload[key] = payload[key] || null
    return payload
  }
  const persist = async payload => {
    setIsSaving(true); setError('')
    try { const updated = await updateStudent(supabase, student.student_id, payload); onDirtyChange(false); onSave(updated) }
    catch (saveError) { setError(saveError.message || '會員資料更新失敗') }
    finally { setIsSaving(false); setPendingPayload(null) }
  }
  const save = () => {
    try {
      const payload = buildPayload()
      if (payload.student_id !== Number(student.student_id)) setPendingPayload(payload)
      else void persist(payload)
    } catch { setError(STUDENT_ID_VALIDATION_MESSAGE) }
  }

  return <div className="form-grid" style={{ padding: 0, background: 'transparent' }}>
    <Field label="ID" id="student-edit-id"><input id="student-edit-id" className="form-input" name="student_id" inputMode="numeric" value={form.student_id} onChange={change} disabled={isSaving} /></Field>
    <Field label="姓名" id="student-edit-name"><input id="student-edit-name" className="form-input" name="name" value={form.name} onChange={change} required disabled={isSaving} /></Field>
    <Field label="性別" id="student-edit-gender"><select id="student-edit-gender" className="form-select" name="gender" value={form.gender} onChange={change} required disabled={isSaving}><option value="">請選擇</option><option value="男">男</option><option value="女">女</option></select></Field>
    <Field label="電子郵件" id="student-edit-email"><input id="student-edit-email" className="form-input" name="email" type="email" value={form.email} onChange={change} disabled={isSaving} /></Field>
    <Field label="電話" id="student-edit-phone"><input id="student-edit-phone" className="form-input" name="phone" value={form.phone} onChange={change} disabled={isSaving} /></Field>
    <Field label="出生年月日" id="student-edit-birth-date"><input id="student-edit-birth-date" className="form-input" name="birth_date" type="date" value={form.birth_date} onChange={change} disabled={isSaving} /></Field>
    <Field label="通訊處" id="student-edit-address"><input id="student-edit-address" className="form-input" name="address" value={form.address} onChange={change} disabled={isSaving} /></Field>
    <Field label="服務機關 / 學校" id="student-edit-organization"><input id="student-edit-organization" className="form-input" name="organization" value={form.organization} onChange={change} disabled={isSaving} /></Field>
    <Field label="教育程度" id="student-edit-education"><select id="student-edit-education" className="form-select" name="education" value={form.education} onChange={change} required disabled={isSaving}><option value="">請選擇</option>{EDUCATION_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}</select></Field>
    {error && <p className="student-edit-error" role="alert">{error}</p>}
    <div className="form-group full-width student-edit-actions"><button type="button" className="btn-secondary" onClick={onCancel} disabled={isSaving}>取消</button><button type="button" className="btn-primary" onClick={save} disabled={isSaving}>儲存變更</button></div>
    <ConfirmDialog isOpen={pendingPayload !== null} title="確認變更 ID" message="變更 ID 會同步更新所有相關報名資料。" confirmLabel="確認變更" cancelLabel="取消" tone="warning" onConfirm={() => void persist(pendingPayload)} onCancel={() => setPendingPayload(null)} />
  </div>
}

function Field({ label, id, children }) { return <div className="form-group"><label className="form-label" htmlFor={id}>{label}</label>{children}</div> }
