import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EDUCATION_OPTIONS } from '../../domain/studentFields'
import StudentProfileSelectField from './StudentProfileSelectField'

export default function MemberProfileStep({ profile, onChange, disabled = false }) {
  return <>
    <Field label="ID（選填）"><Input id="student-id" name="student_id" inputMode="numeric" value={profile.student_id} onChange={onChange} disabled={disabled} /></Field>
    <Field label="姓名"><Input id="student-name" name="name" value={profile.name} onChange={onChange} disabled={disabled} required /></Field>
    <StudentProfileSelectField
      id="member-profile-gender" label="性別" name="gender"
      value={profile.gender} options={['男', '女']}
      onChange={onChange} required disabled={disabled}
    />
    <Field label="電子郵件"><Input id="student-email" name="email" type="email" value={profile.email} onChange={onChange} disabled={disabled} /></Field>
    <Field label="電話"><Input id="student-phone" name="phone" value={profile.phone} onChange={onChange} disabled={disabled} /></Field>
    <Field label="出生年月日"><Input id="student-birth-date" name="birth_date" type="date" value={profile.birth_date} onChange={onChange} disabled={disabled} /></Field>
    <Field label="通訊處"><Input id="student-address" name="address" value={profile.address} onChange={onChange} disabled={disabled} /></Field>
    <Field label="服務機關 / 學校"><Input id="student-organization" name="organization" value={profile.organization} onChange={onChange} disabled={disabled} /></Field>
    <StudentProfileSelectField
      id="student-education" label="教育程度" name="education"
      value={profile.education} options={EDUCATION_OPTIONS}
      onChange={onChange} disabled={disabled}
    />
  </>
}

function Field({ label, children }) {
  return <div className="form-group"><Label htmlFor={children.props.id}>{label}</Label>{children}</div>
}
