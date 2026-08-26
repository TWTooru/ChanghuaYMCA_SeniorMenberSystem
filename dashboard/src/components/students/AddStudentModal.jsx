import { useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { normalizeInitialEnrollmentForm } from '../../domain/initialEnrollment'
import { normalizeStudentId } from '../../domain/studentIdentity'
import { supabase } from '../../lib/supabaseClient'
import { createStudentWithInitialEnrollment } from '../../services/studentService'
import InitialEnrollmentStep from './InitialEnrollmentStep'
import MemberProfileStep from './MemberProfileStep'
import { Button } from '../ui/button'
import { Dialog, DialogClose, DialogContent, DialogTitle } from '../ui/dialog'
import '../common/common.css'

const initialProfile = {
  student_id: '', email: '', name: '', gender: '', phone: '', birth_date: '',
  address: '', organization: '', education: '',
}

const initialEnrollment = {
  period: '', period_start_date: '', period_end_date: '', courses: [], notes: '',
  prepaid_amount: '', prepaid_receipt_number: '', tuition_fee: '', materials_fee: '',
  membership_fee: '', fee_receipt_number: '', handled_by_name: '', reported_on: '',
}

const EMAIL_VALIDATION_MESSAGE = '電子郵件格式不正確'

function normalizeProfile(profile) {
  if (!profile.name.trim() || !profile.gender || !profile.education) {
    throw new Error('請完整填寫姓名、性別與教育程度')
  }
  const payload = Object.fromEntries(
    Object.entries(profile).map(([key, value]) => [key, String(value).trim()]),
  )
  payload.student_id = payload.student_id ? normalizeStudentId(payload.student_id) : null
  payload.email = payload.email.toLowerCase() || null
  if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    throw new Error(EMAIL_VALIDATION_MESSAGE)
  }
  for (const key of ['phone', 'birth_date', 'address', 'organization']) payload[key] ||= null
  return payload
}

export default function AddStudentModal({ onClose, onRefresh }) {
  const { user } = useAuth()
  const [step, setStep] = useState(1)
  const [profile, setProfile] = useState(initialProfile)
  const [enrollment, setEnrollment] = useState(initialEnrollment)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submitInFlightRef = useRef(false)

  const changeProfile = event => {
    const { name, value } = event.target
    setProfile(current => ({ ...current, [name]: value }))
  }

  const changeEnrollment = event => {
    const { name, value } = event.target
    setEnrollment(current => ({ ...current, [name]: value }))
  }

  const handleSubmit = async event => {
    event.preventDefault()
    setError('')
    if (step === 1) {
      try {
        normalizeProfile(profile)
        setStep(2)
      } catch (validationError) {
        setError(validationError.message)
      }
      return
    }
    if (submitInFlightRef.current) return

    let succeeded = false
    try {
      const studentPayload = normalizeProfile(profile)
      const enrollmentPayload = normalizeInitialEnrollmentForm(enrollment)
      submitInFlightRef.current = true
      setIsSubmitting(true)
      await createStudentWithInitialEnrollment(supabase, studentPayload, enrollmentPayload)
      succeeded = true
    } catch (submitError) {
      setError(submitError.message || '新增會員與報名失敗')
    } finally {
      submitInFlightRef.current = false
      setIsSubmitting(false)
    }
    if (succeeded) {
      onRefresh?.()
      onClose()
    }
  }

  const closeModal = isSubmitting ? undefined : onClose
  const handleOpenChange = open => {
    if (!open && !isSubmitting) onClose()
  }

  return <Dialog open onOpenChange={handleOpenChange}>
    <DialogContent showCloseButton={false} className="form-modal-content" id="modal-add-student-overlay" aria-labelledby="add-member-title">
      <div className="modal-header-centered">
        <DialogTitle id="add-member-title">新增會員與第一筆報名</DialogTitle>
        {isSubmitting
          ? <Button type="button" className="btn-close" disabled aria-label="關閉新增會員"><X size={20} /></Button>
          : <DialogClose className="btn-close" aria-label="關閉新增會員"><X size={20} /></DialogClose>}
      </div>
      <form noValidate onSubmit={handleSubmit} className="form-grid">
        <p className="member-wizard-progress">步驟 {step} / 2</p>
        {step === 1
          ? <MemberProfileStep profile={profile} onChange={changeProfile} disabled={isSubmitting} />
          : <InitialEnrollmentStep
              enrollment={enrollment}
              onChange={changeEnrollment}
              onCoursesChange={courses => setEnrollment(current => ({ ...current, courses }))}
              account={user?.email || ''}
              disabled={isSubmitting}
            />}
        {error && <p className="student-edit-error" role="alert">{error}</p>}
        <div className="form-footer full-width">
          {step === 2 && <Button type="button" variant="secondary" onClick={() => { setError(''); setStep(1) }} disabled={isSubmitting}>上一步</Button>}
          <Button type="button" variant="secondary" onClick={closeModal} disabled={isSubmitting}>取消</Button>
          <Button type="submit" disabled={isSubmitting}>{step === 1 ? '下一步' : '新增會員並報名'}</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>
}
