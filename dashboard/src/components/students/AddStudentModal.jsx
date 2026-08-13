import { useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { EDUCATION_OPTIONS } from '../../domain/studentFields'
import { normalizeStudentId, STUDENT_ID_VALIDATION_MESSAGE } from '../../domain/studentIdentity'
import { createStudent } from '../../services/studentService'
import '../common/common.css'

const initialProfile = { student_id: '', email: '', name: '', gender: '', phone: '', birth_date: '', address: '', organization: '', education: '' }
const optionalKeys = ['email', 'phone', 'birth_date', 'address', 'organization']

export default function AddStudentModal({ onClose, onRefresh }) {
  const [profile, setProfile] = useState(initialProfile)
  const [error, setError] = useState('')
  const change = event => setProfile(current => ({ ...current, [event.target.name]: event.target.value }))

  const submit = async event => {
    event.preventDefault()
    try {
      const studentId = profile.student_id.trim() ? normalizeStudentId(profile.student_id) : null
      const payload = Object.fromEntries(Object.entries(profile).map(([key, value]) => [key, String(value).trim()]))
      payload.student_id = studentId
      payload.email = payload.email.toLowerCase()
      for (const key of optionalKeys) payload[key] = payload[key] || null
      await createStudent(supabase, payload)
      onRefresh?.()
      onClose()
    } catch (submitError) {
      setError(submitError.message || STUDENT_ID_VALIDATION_MESSAGE)
    }
  }

  return <div className="modal-overlay-center" onClick={onClose} id="modal-add-student-overlay"><div className="form-modal-content" onClick={event => event.stopPropagation()}>
    <div className="modal-header-centered"><h2>新增會員</h2><button type="button" className="btn-close" onClick={onClose} aria-label="關閉新增會員"><X size={20} /></button></div>
    <form onSubmit={submit} className="form-grid">
      <Field label="ID（選填）"><input id="student-id" className="form-input" name="student_id" inputMode="numeric" value={profile.student_id} onChange={change} /></Field>
      <Field label="姓名"><input id="student-name" className="form-input" name="name" value={profile.name} onChange={change} required /></Field>
      <Field label="性別"><select id="student-gender" className="form-select" name="gender" value={profile.gender} onChange={change} required><option value="">請選擇</option><option value="男">男</option><option value="女">女</option></select></Field>
      <Field label="電子郵件"><input id="student-email" className="form-input" name="email" type="email" value={profile.email} onChange={change} /></Field>
      <Field label="電話"><input id="student-phone" className="form-input" name="phone" value={profile.phone} onChange={change} /></Field>
      <Field label="出生年月日"><input id="student-birth-date" className="form-input" name="birth_date" type="date" value={profile.birth_date} onChange={change} /></Field>
      <Field label="通訊處"><input id="student-address" className="form-input" name="address" value={profile.address} onChange={change} /></Field>
      <Field label="服務機關 / 學校"><input id="student-organization" className="form-input" name="organization" value={profile.organization} onChange={change} /></Field>
      <Field label="教育程度"><select id="student-education" className="form-select" name="education" value={profile.education} onChange={change} required><option value="">請選擇</option>{EDUCATION_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}</select></Field>
      {error && <p className="student-edit-error" role="alert">{error}</p>}
      <div className="form-footer full-width"><button type="button" className="btn-secondary" onClick={onClose}>取消</button><button type="submit" className="btn-primary">新增會員</button></div>
    </form>
  </div></div>
}

function Field({ label, children }) {
  const id = children.props.id
  return <div className="form-group"><label className="form-label" htmlFor={id}>{label}</label>{children}</div>
}
