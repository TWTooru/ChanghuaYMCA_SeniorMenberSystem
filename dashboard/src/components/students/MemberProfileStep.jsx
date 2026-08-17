import { EDUCATION_OPTIONS } from '../../domain/studentFields'

export default function MemberProfileStep({ profile, onChange, disabled = false }) {
  return <>
    <Field label="ID"><input id="student-id" className="form-input" name="student_id" inputMode="numeric" value={profile.student_id} onChange={onChange} disabled={disabled} /></Field>
    <Field label="姓名"><input id="student-name" className="form-input" name="name" value={profile.name} onChange={onChange} disabled={disabled} required /></Field>
    <Field label="性別"><select id="student-gender" className="form-select" name="gender" value={profile.gender} onChange={onChange} disabled={disabled} required><option value="">請選擇</option><option value="男">男</option><option value="女">女</option></select></Field>
    <Field label="電子郵件"><input id="student-email" className="form-input" name="email" type="email" value={profile.email} onChange={onChange} disabled={disabled} /></Field>
    <Field label="電話"><input id="student-phone" className="form-input" name="phone" value={profile.phone} onChange={onChange} disabled={disabled} /></Field>
    <Field label="出生年月日"><input id="student-birth-date" className="form-input" name="birth_date" type="date" value={profile.birth_date} onChange={onChange} disabled={disabled} /></Field>
    <Field label="通訊處"><input id="student-address" className="form-input" name="address" value={profile.address} onChange={onChange} disabled={disabled} /></Field>
    <Field label="服務機關 / 學校"><input id="student-organization" className="form-input" name="organization" value={profile.organization} onChange={onChange} disabled={disabled} /></Field>
    <Field label="教育程度"><select id="student-education" className="form-select" name="education" value={profile.education} onChange={onChange} disabled={disabled} required><option value="">請選擇</option>{EDUCATION_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}</select></Field>
  </>
}

function Field({ label, children }) {
  return <div className="form-group"><label className="form-label" htmlFor={children.props.id}>{label}</label>{children}</div>
}
