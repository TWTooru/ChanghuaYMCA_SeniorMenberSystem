import CourseTagPicker from '../enrollment/CourseTagPicker'

export default function InitialEnrollmentStep({
  enrollment, onChange, onCoursesChange, account, disabled = false,
}) {
  const input = (id, name, type = 'text', extra = {}) => (
    <input id={id} className="form-input" name={name} type={type}
      value={enrollment[name] ?? ''} onChange={onChange} disabled={disabled} {...extra} />
  )
  const money = (id, name) => input(id, name, 'number', { min: '0', step: '1', inputMode: 'numeric' })

  return <>
    <fieldset className="member-wizard-section">
      <legend>報名資料</legend>
      <div className="member-wizard-section-grid">
        <Field label="期別" id="initial-enrollment-period">{input('initial-enrollment-period', 'period', 'text', { required: true, placeholder: '例如：16' })}</Field>
        <Field label="開始日期" id="initial-enrollment-start">{input('initial-enrollment-start', 'period_start_date', 'date', { required: true })}</Field>
        <Field label="結束日期" id="initial-enrollment-end">{input('initial-enrollment-end', 'period_end_date', 'date', { required: true })}</Field>
        <div className="form-group full-width"><span className="form-label">報名課程</span><CourseTagPicker selectedCourseNames={enrollment.courses ?? []} lockedCourseNames={[]} onChange={onCoursesChange} disabled={disabled} /></div>
      </div>
    </fieldset>
    <fieldset className="member-wizard-section">
      <legend>預繳</legend>
      <div className="member-wizard-section-grid">
        <Field label="預繳金額" id="initial-enrollment-prepaid">{money('initial-enrollment-prepaid', 'prepaid_amount')}</Field>
        <Field label="預繳 No." id="initial-enrollment-prepaid-no">{input('initial-enrollment-prepaid-no', 'prepaid_receipt_number')}</Field>
      </div>
    </fieldset>
    <fieldset className="member-wizard-section">
      <legend>正式收據</legend>
      <div className="member-wizard-section-grid">
        <Field label="學費" id="initial-enrollment-tuition">{money('initial-enrollment-tuition', 'tuition_fee')}</Field>
        <Field label="教材費" id="initial-enrollment-materials">{money('initial-enrollment-materials', 'materials_fee')}</Field>
        <Field label="會友費" id="initial-enrollment-membership">{money('initial-enrollment-membership', 'membership_fee')}</Field>
        <Field label="正式收據 No." id="initial-enrollment-fee-no">{input('initial-enrollment-fee-no', 'fee_receipt_number')}</Field>
      </div>
    </fieldset>
    <fieldset className="member-wizard-section">
      <legend>其他資料</legend>
      <div className="member-wizard-section-grid">
        <Field label="備註" id="initial-enrollment-notes" fullWidth><textarea id="initial-enrollment-notes" className="form-input form-textarea" name="notes" rows={3} value={enrollment.notes ?? ''} onChange={onChange} disabled={disabled} /></Field>
        <Field label="經手人姓名" id="initial-enrollment-handler">{input('initial-enrollment-handler', 'handled_by_name')}</Field>
        <Field label="登入帳號（自動帶入）" id="initial-enrollment-account"><input id="initial-enrollment-account" className="form-input" value={account || ''} readOnly aria-readonly="true" /></Field>
        <Field label="辦理日期" id="initial-enrollment-handled-on">{input('initial-enrollment-handled-on', 'handled_on', 'date')}</Field>
      </div>
    </fieldset>
  </>
}

function Field({ label, id, fullWidth = false, children }) {
  return <div className={`form-group${fullWidth ? ' full-width' : ''}`}><label className="form-label" htmlFor={id}>{label}</label>{children}</div>
}
