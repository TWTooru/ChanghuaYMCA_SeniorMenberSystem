import { useRef } from 'react'
import './paymentRecords.css'

const isNonNegativeInteger = value => value === '' || /^\d+$/.test(value)

export default function PaymentRecordsEditor({
  selectedCourseNames = [],
  records = [],
  onChange,
  disabled = false,
}) {
  const nextLocalIdRef = useRef(0)
  const assignedCourseNames = new Set(records.flatMap(record => record.courseNames))
  const canAddRecord = selectedCourseNames.some(courseName => !assignedCourseNames.has(courseName))

  const addRecord = () => {
    onChange([
      ...records,
      {
        localId: `payment-${++nextLocalIdRef.current}`,
        courseNames: [],
        amount: '',
        invoiceNumber: '',
      },
    ])
  }

  const updateRecord = (localId, changes) => {
    onChange(records.map(record => (
      record.localId === localId ? { ...record, ...changes } : record
    )))
  }

  const toggleCourse = (record, courseName) => {
    const courseNames = record.courseNames.includes(courseName)
      ? record.courseNames.filter(name => name !== courseName)
      : [...record.courseNames, courseName]
    updateRecord(record.localId, { courseNames })
  }

  return (
    <section className="payment-records-editor" aria-label="繳費紀錄">
      <div className="payment-records-header">
        <button
          type="button"
          className="btn-secondary payment-records-add"
          onClick={addRecord}
          disabled={disabled || !canAddRecord}
        >
          新增繳費紀錄
        </button>
      </div>

      <div className="payment-records-list">
        {records.map((record, index) => {
          const recordId = `payment-record-${record.localId}`

          return (
            <fieldset
              key={record.localId}
              className="payment-records-record"
              disabled={disabled}
            >
              <legend>繳費紀錄 {index + 1}</legend>

              <div className="payment-records-course-group">
                <span className="payment-records-label">涵蓋課程</span>
                <div className="payment-records-course-list">
                  {selectedCourseNames.map(courseName => {
                    const courseId = `${recordId}-course-${courseName}`
                    const selected = record.courseNames.includes(courseName)
                    const assignedElsewhere = records.some(
                      candidate => candidate.localId !== record.localId
                        && candidate.courseNames.includes(courseName),
                    )

                    return (
                      <label className="payment-records-course" key={courseName} htmlFor={courseId}>
                        <input
                          id={courseId}
                          type="checkbox"
                          checked={selected}
                          disabled={disabled || assignedElsewhere}
                          onChange={() => toggleCourse(record, courseName)}
                        />
                        {courseName}
                      </label>
                    )
                  })}
                </div>
              </div>

              <div className="payment-records-fields">
                <label htmlFor={`${recordId}-amount`}>
                  總金額
                  <input
                    id={`${recordId}-amount`}
                    className="form-input"
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    value={record.amount ?? ''}
                    disabled={disabled}
                    onChange={event => {
                      if (isNonNegativeInteger(event.target.value)) {
                        updateRecord(record.localId, { amount: event.target.value })
                      }
                    }}
                  />
                </label>
                <label htmlFor={`${recordId}-invoice-number`}>
                  收據編號
                  <input
                    id={`${recordId}-invoice-number`}
                    className="form-input"
                    value={record.invoiceNumber ?? ''}
                    disabled={disabled}
                    onChange={event => updateRecord(record.localId, { invoiceNumber: event.target.value })}
                  />
                </label>
              </div>

              <button
                type="button"
                className="btn-secondary payment-records-add payment-records-remove"
                onClick={() => onChange(records.filter(candidate => candidate.localId !== record.localId))}
                disabled={disabled}
              >
                移除繳費紀錄
              </button>
            </fieldset>
          )
        })}
      </div>
    </section>
  )
}
