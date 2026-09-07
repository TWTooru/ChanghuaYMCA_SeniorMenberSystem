import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { EDUCATION_OPTIONS } from '../../domain/studentFields'
import { normalizeStudentId, STUDENT_ID_VALIDATION_MESSAGE } from '../../domain/studentIdentity'
import { updateStudent } from '../../services/studentService'
import ConfirmDialog from '../common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import StudentProfileSelectField from './StudentProfileSelectField'

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

  return <div className="form-grid student-profile-form" style={{ padding: 0, background: 'transparent' }}>
    <Field label="ID" id="student-edit-id"><Input id="student-edit-id" className="h-10" name="student_id" inputMode="numeric" value={form.student_id} onChange={change} disabled={isSaving} /></Field>
    <Field label="姓名" id="student-edit-name"><Input id="student-edit-name" className="h-10" name="name" value={form.name} onChange={change} required disabled={isSaving} /></Field>
    <StudentProfileSelectField id="student-edit-gender" label="性別" name="gender" value={form.gender} options={['男', '女']} onChange={change} required disabled={isSaving} />
    <Field label="電子郵件" id="student-edit-email"><Input id="student-edit-email" className="h-10" name="email" type="email" value={form.email} onChange={change} disabled={isSaving} /></Field>
    <Field label="電話" id="student-edit-phone"><Input id="student-edit-phone" className="h-10" name="phone" value={form.phone} onChange={change} disabled={isSaving} /></Field>
    <Field label="出生年月日" id="student-edit-birth-date"><Input id="student-edit-birth-date" className="h-10" name="birth_date" type="date" value={form.birth_date} onChange={change} disabled={isSaving} /></Field>
    <Field label="通訊處" id="student-edit-address"><Input id="student-edit-address" className="h-10" name="address" value={form.address} onChange={change} disabled={isSaving} /></Field>
    <Field label="服務機關 / 學校" id="student-edit-organization"><Input id="student-edit-organization" className="h-10" name="organization" value={form.organization} onChange={change} disabled={isSaving} /></Field>
    <StudentProfileSelectField id="student-edit-education" label="教育程度" name="education" value={form.education} options={EDUCATION_OPTIONS} onChange={change} required disabled={isSaving} />
    {error && <p className="student-edit-error" role="alert">{error}</p>}
    <div className="form-group full-width student-edit-actions"><Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving}>取消</Button><Button type="button" onClick={save} disabled={isSaving}>儲存變更</Button></div>
    <ConfirmDialog isOpen={pendingPayload !== null} title="確認變更 ID" message="變更 ID 會同步更新所有相關報名資料。" confirmLabel="確認變更" cancelLabel="取消" tone="warning" onConfirm={() => void persist(pendingPayload)} onCancel={() => setPendingPayload(null)} />
  </div>
}

function Field({ label, id, children }) { return <div className="form-group"><Label htmlFor={id}>{label}</Label>{children}</div> }
