import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import StudentInfoView from './StudentInfoView'
import EnrollmentTimeline from '../enrollment/EnrollmentTimeline'
import StudentDetailModal from './StudentDetailModal'

const testDirectory = dirname(fileURLToPath(import.meta.url))
const commonStyles = readFileSync(resolve(testDirectory, '../common/common.css'), 'utf8')
const studentStyles = readFileSync(resolve(testDirectory, './students.css'), 'utf8')

const authState = vi.hoisted(() => ({ role: 'viewer' }))

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => authState,
}))

const student = {
  // 共用 fixture 以固定學員資料，讓焦點與未儲存變更測試能專注驗證對話框生命週期。
  student_id: 1,
  name: '王小明',
  birth_date: '1960-01-01',
  phone: '0912345678',
  email: 'member@example.com',
  education: '專科/大學'
}
const enrollment = { enrollment_id: 1, student_id: student.student_id, period: '第15期', courses: ['電腦課'] }

describe('Student detail components', () => {
  let styleElement

  beforeEach(() => {
    styleElement = document.createElement('style')
    styleElement.textContent = `${commonStyles}\n${studentStyles}`
    document.head.append(styleElement)
  })

  afterEach(() => {
    styleElement.remove()
    authState.role = 'viewer'
    cleanup()
  })
  it('renders the student contact details', () => {
    render(<StudentInfoView student={student} />)

    expect(screen.getByText('會員資料')).not.toBeNull()
    expect(screen.getByText(/1960-01-01/)).not.toBeNull()
    expect(screen.getByText('0912345678')).not.toBeNull()
  })

  it('opens history by default and renders only the active folder', () => {
    const { container } = render(<StudentDetailModal student={student} enrollments={[enrollment]} initialTab="history" onClose={vi.fn()} />)

    expect(screen.getByRole('tab', { name: '歷年修課（1 期）' }).getAttribute('aria-selected')).toBe('true')
    expect(within(container.querySelector('.timeline-section')).getByText('第15期')).not.toBeNull()
    expect(screen.queryByText('基本聯絡資料')).toBeNull()
    expect(container.querySelector('.student-detail-dialog')).not.toBeNull()
  })

  it('switches to profile without rendering history', () => {
    render(<StudentDetailModal student={student} enrollments={[enrollment]} initialTab="history" onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('tab', { name: '基本資料' }))

    expect(screen.getByText('會員資料')).not.toBeNull()
    expect(screen.queryByText('第15期')).toBeNull()
  })

  it('uses the student detail body as the only vertical scroll container while editing', () => {
    authState.role = 'admin'
    const { container } = render(
      <StudentDetailModal student={student} enrollments={[]} initialTab="profile" onClose={vi.fn()} />
    )

    fireEvent.click(screen.getByRole('button', { name: /編輯/ }))

    const detailBody = container.querySelector('.student-detail-body')
    const editGrid = detailBody.querySelector('.form-grid')
    expect(getComputedStyle(detailBody).overflowY).toBe('auto')
    expect(getComputedStyle(editGrid).overflowY).toBe('visible')
  })

  it('closes with Escape and restores focus to the opener', () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    const onClose = vi.fn()
    const { unmount } = render(<StudentDetailModal student={student} enrollments={[]} onClose={onClose} />)

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
    unmount()
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })

  it('keeps Tab navigation inside the dialog', () => {
    render(<StudentDetailModal student={student} enrollments={[]} onClose={vi.fn()} />)

    const dialog = screen.getByRole('dialog')
    const closeButton = screen.getByRole('button', { name: '關閉學員資料' })
    const historyTab = screen.getByRole('tab', { name: '歷年修課（0 期）' })
    historyTab.focus()
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(document.activeElement).toBe(closeButton)

    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(historyTab)
  })

  it('guards tab changes when profile edits are unsaved', () => {
    authState.role = 'admin'
    render(<StudentDetailModal student={student} enrollments={[enrollment]} initialTab="profile" onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /編輯/ }))
    fireEvent.change(screen.getByDisplayValue('王小明'), { target: { value: '王大明' } })
    fireEvent.click(screen.getByRole('tab', { name: '歷年修課（1 期）' }))

    expect(screen.getByText('尚有未儲存變更')).not.toBeNull()
    expect(screen.getByDisplayValue('王大明')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '繼續編輯' }))
    expect(screen.getByDisplayValue('王大明')).not.toBeNull()
  })

  it('closes only the profile select on Escape before applying the dirty guard', async () => {
    authState.role = 'admin'
    const onClose = vi.fn()
    render(<StudentDetailModal student={student} enrollments={[]} initialTab="profile" onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /編輯/ }))
    fireEvent.change(screen.getByDisplayValue('王小明'), { target: { value: '王大明' } })
    const trigger = screen.getByRole('combobox', { name: '性別' })
    fireEvent.click(trigger)
    const option = await screen.findByRole('option', { name: '女', exact: true })

    fireEvent.keyDown(option, { key: 'Escape' })

    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
    expect(document.activeElement).toBe(trigger)
    expect(screen.queryByText('尚有未儲存變更')).toBeNull()
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.keyDown(trigger, { key: 'Escape' })
    expect(screen.getByText('尚有未儲存變更')).not.toBeNull()
  })

  it('closes only the stacked profile select on the first Escape', async () => {
    authState.role = 'admin'
    const onClose = vi.fn()
    render(<StudentDetailModal student={student} enrollments={[]} initialTab="profile" isTabbed={false} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /編輯/ }))
    fireEvent.change(screen.getByDisplayValue('王小明'), { target: { value: '王大明' } })
    const trigger = screen.getByRole('combobox', { name: '性別' })
    fireEvent.click(trigger)
    const option = await screen.findByRole('option', { name: '女', exact: true })

    fireEvent.keyDown(option, { key: 'Escape' })

    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
    expect(document.activeElement).toBe(trigger)
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.keyDown(trigger, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('guards a tab change after the gender select makes the profile dirty', async () => {
    authState.role = 'admin'
    render(<StudentDetailModal student={student} enrollments={[enrollment]} initialTab="profile" onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /編輯/ }))
    fireEvent.click(screen.getByRole('combobox', { name: '性別' }))
    const option = await screen.findByRole('option', { name: '女', exact: true })
    fireEvent.pointerDown(option, { pointerType: 'mouse' })
    fireEvent.click(option)

    fireEvent.click(screen.getByRole('tab', { name: '歷年修課（1 期）' }))

    expect(screen.getByText('尚有未儲存變更')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '繼續編輯' }))
    expect(screen.getByRole('combobox', { name: '性別' }).textContent).toContain('女')

    fireEvent.click(screen.getByRole('tab', { name: '歷年修課（1 期）' }))
    fireEvent.click(screen.getByRole('button', { name: '放棄變更' }))

    expect(screen.getByRole('tab', { name: '歷年修課（1 期）' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.queryByRole('combobox', { name: '性別' })).toBeNull()
  })

  it('discards edits and performs the pending close', () => {
    const onClose = vi.fn()
    authState.role = 'admin'
    const { container } = render(<StudentDetailModal student={student} enrollments={[]} initialTab="profile" onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /編輯/ }))
    fireEvent.change(screen.getByDisplayValue('王小明'), { target: { value: '王大明' } })
    fireEvent.click(container.querySelector('#btn-close-modal'))
    fireEvent.click(screen.getByRole('button', { name: '放棄變更' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('guards close button and Escape dismissal when profile edits are unsaved', () => {
    const onClose = vi.fn()
    authState.role = 'admin'
    const { container } = render(<StudentDetailModal student={student} enrollments={[]} initialTab="profile" onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /編輯/ }))
    fireEvent.change(screen.getByDisplayValue('王小明'), { target: { value: '王大明' } })

    fireEvent.click(container.querySelector('#btn-close-modal'))
    expect(screen.getByText('尚有未儲存變更')).not.toBeNull()
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '繼續編輯' }))

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.getByText('尚有未儲存變更')).not.toBeNull()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('shows enrollment details and delegates adding an enrollment', () => {
    const onAddEnrollment = vi.fn()
    render(
      <EnrollmentTimeline
        timeline={[{ enrollment_id: 1, period: '第15期', reg_type: '新', courses: ['電腦課'] }]}
        onAddEnrollment={onAddEnrollment}
      />
    )

    expect(screen.getByText('第15期')).not.toBeNull()
    expect(screen.getByText('電腦課')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /新增選課紀錄/ }))
    expect(onAddEnrollment).toHaveBeenCalledOnce()
  })

  it('shows only enrollments belonging to the selected student_id when names match', () => {
    const { container } = render(
      <StudentDetailModal
        student={{ ...student, student_id: 'S-002' }}
        enrollments={[
          { enrollment_id: 1, student_id: 'S-001', student_name: '王小明', period: '第14期', courses: ['電腦課'] },
          { enrollment_id: 2, student_id: 'S-002', student_name: '王小明', period: '第15期', courses: ['手機課'] }
        ]}
        onClose={vi.fn()}
        onAddEnrollment={vi.fn()}
        onRefresh={vi.fn()}
      />
    )

    const timeline = within(container.querySelector('.timeline-section'))
    expect(timeline.getByText('第15期')).not.toBeNull()
    expect(timeline.getByText('手機課')).not.toBeNull()
    expect(screen.queryByText('第14期')).toBeNull()
    expect(screen.queryByText('電腦課')).toBeNull()
  })

  it('sorts the timeline by numeric period order', () => {
    const { container } = render(
      <StudentDetailModal
        student={student}
        enrollments={[
          { enrollment_id: 1, student_id: student.student_id, period: '第16期', courses: ['較晚課程'] },
          { enrollment_id: 2, student_id: student.student_id, period: '第15期', courses: ['較早課程'] },
        ]}
        onClose={vi.fn()}
        onAddEnrollment={vi.fn()}
        onRefresh={vi.fn()}
      />
    )

    expect(container.querySelector('.timeline-container').textContent.indexOf('第15期')).toBeLessThan(container.querySelector('.timeline-container').textContent.indexOf('第16期'))
  })

  it('hides student and enrollment mutation controls from viewers', () => {
    authState.role = 'viewer'
    const { container } = render(
      <StudentDetailModal
        student={student}
        enrollments={[{ enrollment_id: 1, student_id: student.student_id, season: 'Season A', courses: [] }]}
        onClose={vi.fn()}
        onAddEnrollment={vi.fn()}
        onRefresh={vi.fn()}
      />
    )

    expect(container.querySelector('.btn-edit')).toBeNull()
    expect(container.querySelector('.btn-delete')).toBeNull()
    expect(container.querySelector('#btn-add-enrollment-modal')).toBeNull()
    expect(container.querySelector('.timeline-action-btn')).toBeNull()
  })

  it('hides disabled enrollment controls while preserving permitted edit controls', () => {
    const { container } = render(
      <EnrollmentTimeline
        timeline={[{ enrollment_id: 1, season: 'Season A', courses: [] }]}
        onAddEnrollment={null}
        onDelete={null}
        onEditEnrollment={true}
      />
    )

    expect(container.querySelector('#btn-add-enrollment-modal')).toBeNull()
    expect(container.querySelector('.timeline-action-btn')).not.toBeNull()
    expect(container.querySelector('.timeline-action-btn.danger')).toBeNull()
  })

  it('closes a student edit form when the current role loses edit permission', () => {
    authState.role = 'admin'
    const props = {
      student,
      enrollments: [],
      onClose: vi.fn(),
      onAddEnrollment: vi.fn(),
      onRefresh: vi.fn(),
    }
    const { container, rerender } = render(<StudentDetailModal {...props} initialTab="profile" />)

    fireEvent.click(container.querySelector('.btn-edit'))
    expect(container.querySelector('input[name="name"]')).not.toBeNull()

    authState.role = 'viewer'
    rerender(<StudentDetailModal {...props} initialTab="profile" />)

    expect(container.querySelector('input[name="name"]')).toBeNull()
  })

  it('closes open student and enrollment deletion confirmations when delete permission is removed', () => {
    authState.role = 'admin'
    const props = {
      student,
      enrollments: [{ enrollment_id: 1, student_id: student.student_id, season: 'Season A', courses: [] }],
      onClose: vi.fn(),
      onAddEnrollment: vi.fn(),
      onRefresh: vi.fn(),
    }
    const { container, rerender } = render(<StudentDetailModal {...props} />)

    fireEvent.click(container.querySelector('.btn-delete'))
    expect(container.querySelector('.modal-overlay-center')).not.toBeNull()

    authState.role = 'editor'
    rerender(<StudentDetailModal {...props} />)
    expect(container.querySelector('.modal-overlay-center')).toBeNull()

    authState.role = 'admin'
    rerender(<StudentDetailModal {...props} />)
    expect(container.querySelector('.modal-overlay-center')).toBeNull()
    fireEvent.click(container.querySelector('.timeline-action-btn.danger'))
    expect(container.querySelector('.modal-overlay-center')).not.toBeNull()

    authState.role = 'editor'
    rerender(<StudentDetailModal {...props} />)
    expect(container.querySelector('.modal-overlay-center')).toBeNull()
  })

  it('closes an enrollment edit form when edit permission is removed', () => {
    const timeline = [{ enrollment_id: 1, season: 'Season A', courses: [] }]
    const { container, rerender } = render(
      <EnrollmentTimeline timeline={timeline} onEditEnrollment={true} />
    )

    fireEvent.click(container.querySelector('.timeline-action-btn'))
    expect(container.querySelector('.enrollment-edit-form')).not.toBeNull()

    rerender(<EnrollmentTimeline timeline={timeline} onEditEnrollment={false} />)
    expect(container.querySelector('.enrollment-edit-form')).toBeNull()
  })

  it('renders the selected student trend before the enrollment timeline', () => {
    const { container } = render(
      <StudentDetailModal
        student={{ ...student, student_id: 'S-002' }}
        enrollments={[
          { enrollment_id: 1, student_id: 'S-001', season: '第十五季', courses: ['電腦課'] },
          { enrollment_id: 2, student_id: 'S-002', season: '第十五季', courses: ['手機課'] },
          { enrollment_id: 3, student_id: 'S-002', season: '第十六季', courses: ['手機課'] },
        ]}
        onClose={vi.fn()}
      />
    )

    const trend = container.querySelector('.student-course-trend')
    const timeline = container.querySelector('.timeline-section')
    expect(trend).toBeNull()
    if (!trend) return
    expect(trend.textContent).toContain('手機課')
    expect(trend.textContent).toContain('2 次')
    expect(trend.textContent).not.toContain('電腦課')
    expect(trend.compareDocumentPosition(timeline) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('also renders the trend in the non-tabbed history layout', () => {
    const { container } = render(
      <StudentDetailModal
        student={student}
        enrollments={[enrollment]}
        isTabbed={false}
        onClose={vi.fn()}
      />
    )

    expect(container.querySelector('.student-course-trend')).toBeNull()
    if (!container.querySelector('.student-course-trend')) return
    expect(screen.getByRole('heading', { name: '學生選課趨勢圖' })).not.toBeNull()
  })
  describe('billing detail integration', () => {
    const billingStudent = {
      student_id: 'billing-student',
      name: 'Billing Student',
      gender: '男',
    }
    const billingEnrollment = {
      enrollment_id: 42,
      student_id: billingStudent.student_id,
      period: 'Integration Period',
      reg_type: 'regular',
      refunded: false,
      courses: ['Integration Course'],
      forms: [
        {
          form_id: 1,
          form_sequence: 1,
          courses: ['Integration Course'],
          refunded: false,
        },
      ],
      billingReceipts: [
        {
          receiptId: 1,
          amount: 1500,
          invoiceNumber: 'A-001',
          courses: [{ courseId: 1, courseName: 'Integration Course' }],
        },
      ],
      courseDetails: [
        { courseId: 1, courseName: 'Integration Course', billingReceiptId: 1 },
      ],
    }

    function openBillingDetail({ isTabbed = true, keyboard = true, onClose = vi.fn() } = {}) {
      const view = render(
        <StudentDetailModal
          student={billingStudent}
          enrollments={[billingEnrollment]}
          initialTab="history"
          isTabbed={isTabbed}
          onClose={onClose}
          onRefresh={vi.fn()}
        />
      )
      const trigger = screen.getByText('Integration Period').closest('button')
      if (keyboard) {
        trigger.focus()
        fireEvent.keyDown(trigger, { key: 'Enter' })
      }
      fireEvent.click(trigger)
      return { ...view, onClose, trigger }
    }

    it('opens billing details for the clicked timeline enrollment', () => {
      const { container } = render(
        <StudentDetailModal
          student={billingStudent}
          enrollments={[billingEnrollment]}
          initialTab="history"
          isTabbed={true}
          onClose={vi.fn()}
          onRefresh={vi.fn()}
        />
      )

      fireEvent.click(screen.getByText('Integration Period').closest('button'))

      const billingDialog = container.querySelector('.enrollment-billing-dialog')
      expect(billingDialog).not.toBeNull()
      expect(billingDialog.textContent).toContain('Billing Student')
      expect(billingDialog.textContent).toContain('Integration Period')
    })

    it('closes billing details while keeping the student detail modal open', () => {
      const { container } = render(
        <StudentDetailModal
          student={billingStudent}
          enrollments={[billingEnrollment]}
          initialTab="history"
          isTabbed={true}
          onClose={vi.fn()}
          onRefresh={vi.fn()}
        />
      )

      fireEvent.click(screen.getByText('Integration Period').closest('button'))
      fireEvent.click(screen.getByRole('button', { name: 'Close enrollment billing details' }))

      expect(container.querySelector('.enrollment-billing-dialog')).toBeNull()
      expect(container.querySelector('.student-detail-dialog')).not.toBeNull()
      expect(container.querySelector('.student-detail-dialog .modal-name').textContent).toContain('Billing Student')
    })

    it.each([
      { isTabbed: true, layout: 'tabbed' },
      { isTabbed: false, layout: 'non-tabbed' },
    ])('opens from the keyboard into an isolated billing dialog in the $layout layout', ({ isTabbed }) => {
      const { container, trigger } = openBillingDetail({ isTabbed })
      const studentDialog = container.querySelector('.student-detail-dialog')
      const billingDialog = container.querySelector('.enrollment-billing-dialog')
      const billingClose = screen.getByRole('button', { name: 'Close enrollment billing details' })

      expect(trigger.isConnected).toBe(true)
      expect(studentDialog.getAttribute('aria-hidden')).toBe('true')
      expect(studentDialog.hasAttribute('inert')).toBe(true)
      expect(studentDialog.getAttribute('aria-modal')).toBeNull()
      expect(billingDialog.getAttribute('aria-modal')).toBe('true')
      expect(document.activeElement).toBe(billingClose)
    })

    it.each([
      { isTabbed: true, layout: 'tabbed' },
      { isTabbed: false, layout: 'non-tabbed' },
    ])('contains forward and reverse Tab navigation inside $layout billing details', ({ isTabbed }) => {
      authState.role = 'admin'
      const { container } = openBillingDetail({ isTabbed })
      const billingDialog = container.querySelector('.enrollment-billing-dialog')
      const focusableElements = Array.from(billingDialog.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      const first = focusableElements[0]
      const last = focusableElements[focusableElements.length - 1]

      last.focus()
      fireEvent.keyDown(last, { key: 'Tab' })
      expect(document.activeElement).toBe(first)

      first.focus()
      fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })
      expect(document.activeElement).toBe(last)
    })

    it.each([
      { isTabbed: true, layout: 'tabbed' },
      { isTabbed: false, layout: 'non-tabbed' },
    ])('uses Escape to close only $layout billing details and restores trigger focus', ({ isTabbed }) => {
      const onClose = vi.fn()
      const { container, trigger } = openBillingDetail({ isTabbed, onClose })

      fireEvent.keyDown(document.activeElement, { key: 'Escape' })

      expect(container.querySelector('.enrollment-billing-dialog')).toBeNull()
      expect(container.querySelector('.student-detail-dialog')).not.toBeNull()
      expect(onClose).not.toHaveBeenCalled()
      expect(document.activeElement).toBe(trigger)
    })

    it('restores focus to the pointer trigger even when the browser does not focus it on click', () => {
      const { trigger } = openBillingDetail({ keyboard: false })

      fireEvent.click(screen.getByRole('button', { name: 'Close enrollment billing details' }))

      expect(document.activeElement).toBe(trigger)
    })

    it('recovers Tab containment when focus falls to document body inside billing details', () => {
      authState.role = 'admin'
      openBillingDetail()
      const closeBtn = screen.getByRole('button', { name: 'Close enrollment billing details' })
      closeBtn.focus()
      closeBtn.blur()
      expect(document.activeElement).toBe(document.body)

      fireEvent.keyDown(document.body, { key: 'Tab' })

      expect(document.activeElement).toBe(closeBtn)
    })

    it('keeps Escape owned by billing details after focus is lost from the child layer', () => {
      const onClose = vi.fn()
      const { container, trigger } = openBillingDetail({ onClose })
      document.activeElement.blur()

      fireEvent.keyDown(document.body, { key: 'Escape' })

      expect(container.querySelector('.enrollment-billing-dialog')).toBeNull()
      expect(container.querySelector('.student-detail-dialog')).not.toBeNull()
      expect(onClose).not.toHaveBeenCalled()
      expect(document.activeElement).toBe(trigger)
    })

    it('routes reverse Tab from the billing layer fallback to its last available control', () => {
      const { container } = openBillingDetail()
      const billingLayer = container.querySelector('.student-detail-billing-layer')
      const billingClose = screen.getByRole('button', { name: 'Close enrollment billing details' })
      billingLayer.focus()

      fireEvent.keyDown(billingLayer, { key: 'Tab', shiftKey: true })

      expect(document.activeElement).toBe(billingClose)
    })
  })
})
