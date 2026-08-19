import re

with open('dashboard/src/components/enrollment/EnrollmentBillingDetailModal.jsx', 'r', encoding='utf-8') as f:
    f_content = f.read()

# Add imports
f_content = f_content.replace(
  "import usePermissions from '../../hooks/usePermissions'",
  "import usePermissions from '../../hooks/usePermissions'\nimport useUnsavedChangesGuard from '../../hooks/useUnsavedChangesGuard'"
)
f_content = f_content.replace(
  "import {",
  "import ConfirmDialog from '../common/ConfirmDialog'\nimport {"
)

# Add state and hooks
f_content = f_content.replace(
  "const [success, setSuccess] = useState('')",
  """const [success, setSuccess] = useState('')
  const [isRefundConfirmOpen, setRefundConfirmOpen] = useState(false)
  const {
    hasUnsavedChanges,
    setHasUnsavedChanges,
    pendingAction,
    requestAction,
    confirmPendingAction,
    cancelPendingAction,
  } = useUnsavedChangesGuard()"""
)

# Clear pending action in useEffect
f_content = f_content.replace(
  "setSuccess('')\n  }, [enrollmentId, enrollment])",
  "setSuccess('')\n    setHasUnsavedChanges(false)\n    cancelPendingAction()\n  }, [enrollmentId, enrollment])"
)

# Add handleFieldChange
f_content = f_content.replace(
  "const clearMessages = () => {\n    setError('')\n    setSuccess('')\n  }",
  """const clearMessages = () => {
    setError('')
    setSuccess('')
  }

  const handleFieldChange = (field, value) => {
    setHasUnsavedChanges(true)
    setFormData(prev => ({ ...prev, [field]: value }))
  }"""
)

# Modify handleClose, handleStartEdit, handleCancel
f_content = f_content.replace(
  "const handleClose = () => {\n    if (!saveInFlight.current) onClose?.()\n  }",
  """const handleClose = () => {
    if (!saveInFlight.current) {
      if (isEditing && hasUnsavedChanges) {
        requestAction(() => onClose?.())
      } else {
        onClose?.()
      }
    }
  }"""
)

f_content = f_content.replace(
  "setFormData(createInitialFormData(enrollment))\n    setIsEditing(true)",
  "setFormData(createInitialFormData(enrollment))\n    setHasUnsavedChanges(false)\n    setIsEditing(true)"
)

f_content = f_content.replace(
  """  const handleCancel = () => {
    clearMessages()
    setFormData(createInitialFormData(enrollment))
    setIsEditing(false)
  }""",
  """  const handleCancel = () => {
    const doCancel = () => {
      clearMessages()
      setFormData(createInitialFormData(enrollment))
      setIsEditing(false)
      setHasUnsavedChanges(false)
    }

    if (hasUnsavedChanges) {
      requestAction(doCancel)
    } else {
      doCancel()
    }
  }"""
)

# Handle save
f_content = f_content.replace(
  "setIsEditing(false)\n      onRefresh?.()",
  "setIsEditing(false)\n      setHasUnsavedChanges(false)\n      onRefresh?.()"
)

# Handle Refund
f_content = f_content.replace(
  """  const handleRefundToggle = async () => {
    if (!permissions.canEditEnrollment || saveInFlight.current) return

    const newRefunded = !enrollment.refunded""",
  """  const handleRefundClick = () => {
    if (!permissions.canEditEnrollment || saveInFlight.current) return
    setRefundConfirmOpen(true)
  }

  const handleRefundConfirm = async () => {
    setRefundConfirmOpen(false)
    const newRefunded = !enrollment.refunded"""
)

# Button refund toggle click
f_content = f_content.replace(
  "onClick={handleRefundToggle}",
  "onClick={handleRefundClick}"
)

# Dialog renders
f_content = f_content.replace(
  "        </div>\n      </div>\n    </div>",
  """        </div>
      </div>

      <ConfirmDialog
        isOpen={!!pendingAction}
        title="尚有未儲存變更"
        message="離開後本次修改將不會保留，確定要放棄變更嗎？"
        confirmLabel="放棄變更"
        onConfirm={confirmPendingAction}
        onCancel={cancelPendingAction}
      />
      
      <ConfirmDialog
        isOpen={isRefundConfirmOpen}
        title={enrollment.refunded ? "取消退費確認" : "標記退費確認"}
        message={enrollment.refunded ? "確定要將此筆報名恢復為正常狀態嗎？" : "確定要將此筆報名標記為退費嗎？此操作可透過「取消退費」復原。"}
        confirmLabel={enrollment.refunded ? "確定恢復" : "確定退費"}
        onConfirm={handleRefundConfirm}
        onCancel={() => setRefundConfirmOpen(false)}
      />
    </div>"""
)

f_content = re.sub(
    r'onChange=\{e => setFormData\(prev => \(\{ \.\.\.prev, ([a-zA-Z0-9_]+): e\.target\.value \}\)\)\}',
    r"onChange={e => handleFieldChange('\g<1>', e.target.value)}",
    f_content
)

with open('dashboard/src/components/enrollment/EnrollmentBillingDetailModal.jsx', 'w', encoding='utf-8') as f:
    f.write(f_content)
