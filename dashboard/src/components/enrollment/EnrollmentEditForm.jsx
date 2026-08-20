import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { normalizePeriod, periodNumber } from '../../domain/period'
import { updateEnrollmentPeriod } from '../../services/enrollmentService'

export default function EnrollmentEditForm({ enrollment, onSave, onCancel }) {
  const initialPeriodNum = periodNumber(enrollment.period)
  const [form, setForm] = useState({
    period: initialPeriodNum > 0 ? String(initialPeriodNum) : (enrollment.period || ''),
    period_start_date: enrollment.period_start_date || '',
    period_end_date: enrollment.period_end_date || '',
  })
  const [saveError, setSaveError] = useState('')

  const handleSave = async () => {
    setSaveError('')
    try {
      const normalizedPeriod = normalizePeriod(form.period)
      if (!normalizedPeriod) {
        alert('請輸入有效的期別，例如：第16期')
        return
      }
      if (form.period_start_date && form.period_end_date && form.period_start_date > form.period_end_date) {
        setSaveError('結束日期不能早於開始日期')
        return
      }
      await updateEnrollmentPeriod(
        supabase,
        enrollment.enrollment_id,
        {
          period: normalizedPeriod,
          period_start_date: form.period_start_date || null,
          period_end_date: form.period_end_date || null,
        },
      )

      alert('選課期別已更新')
      onSave()
    } catch (err) {
      setSaveError('伺服器錯誤: ' + err.message)
    }
  }

  return (
    <div className="enrollment-edit-form">
      <div className="form-group">
        <label className="form-label" htmlFor="edit-enrollment-period">修課期別</label>
        <div className="period-input-group">
          <span className="period-prefix">第</span>
          <input
            id="edit-enrollment-period"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            className="form-input period-number-input"
            placeholder="16"
            value={form.period ?? ''}
            onChange={e => setForm({ ...form, period: e.target.value })}
          />
          <span className="period-suffix">期</span>
        </div>
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="edit-enrollment-start-date">開始日期</label>
        <input
          id="edit-enrollment-start-date"
          type="date"
          className="form-input"
          value={form.period_start_date}
          onChange={e => setForm({ ...form, period_start_date: e.target.value })}
        />
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="edit-enrollment-end-date">結束日期</label>
        <input
          id="edit-enrollment-end-date"
          type="date"
          className="form-input"
          value={form.period_end_date}
          onChange={e => setForm({ ...form, period_end_date: e.target.value })}
        />
      </div>
      {saveError && <div role="alert" style={{ gridColumn: 'span 2', color: 'var(--color-danger)' }}>{saveError}</div>}
      <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
        <button type="button" className="btn-secondary" onClick={onCancel}>取消</button>
        <button type="button" className="btn-primary" onClick={handleSave}>儲存</button>
      </div>
    </div>
  )
}
