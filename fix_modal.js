const fs = require('fs');

let f = fs.readFileSync('dashboard/src/components/enrollment/EnrollmentBillingDetailModal.jsx', 'utf8');

// 1. imports
f = f.replace(
  "import usePermissions from '../../hooks/usePermissions'",
  "import usePermissions from '../../hooks/usePermissions'\nimport useUnsavedChangesGuard from '../../hooks/useUnsavedChangesGuard'\nimport ConfirmDialog from '../common/ConfirmDialog'"
);

// 2. state and hooks
f = f.replace(
  "const [success, setSuccess] = useState('')",
  `const [success, setSuccess] = useState('')
  const [isRefundConfirmOpen, setRefundConfirmOpen] = useState(false)
  const {
    hasUnsavedChanges,
    setHasUnsavedChanges,
    pendingAction,
    requestAction,
    confirmPendingAction,
    cancelPendingAction,
  } = useUnsavedChangesGuard()`
);

// 3. useEffect
f = f.replace(
  "setSuccess('')\n  }, [enrollmentId, enrollment])",
  "setSuccess('')\n    setHasUnsavedChanges(false)\n    cancelPendingAction()\n  }, [enrollmentId, enrollment])"
);

// 4. clearMessages and handleFieldChange
f = f.replace(
  "const clearMessages = () => {\n    setError('')\n    setSuccess('')\n  }",
  `const clearMessages = () => {
    setError('')
    setSuccess('')
  }

  const handleFieldChange = (field, value) => {
    setHasUnsavedChanges(true)
    setFormData(prev => ({ ...prev, [field]: value }))
  }`
);

// 5. handleClose
f = f.replace(
  "const handleClose = () => {\n    if (!saveInFlight.current) onClose?.()\n  }",
  `const handleClose = () => {
    if (!saveInFlight.current) {
      if (isEditing && hasUnsavedChanges) {
        requestAction(() => onClose?.())
      } else {
        onClose?.()
      }
    }
  }`
);

// 6. handleStartEdit
f = f.replace(
  "setFormData(createInitialFormData(enrollment))\n    setIsEditing(true)",
  "setFormData(createInitialFormData(enrollment))\n    setHasUnsavedChanges(false)\n    setIsEditing(true)"
);

// 7. handleCancel
f = f.replace(
  `  const handleCancel = () => {
    clearMessages()
    setFormData(createInitialFormData(enrollment))
    setIsEditing(false)
  }`,
  `  const handleCancel = () => {
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
  }`
);

// 8. handleSave
f = f.replace(
  "setIsEditing(false)\n      onRefresh?.()",
  "setIsEditing(false)\n      setHasUnsavedChanges(false)\n      onRefresh?.()"
);

// 9. handleRefundToggle -> handleRefundClick
f = f.replace(
  `  const handleRefundToggle = async () => {
    if (!permissions.canEditEnrollment || saveInFlight.current) return

    const newRefunded = !enrollment.refunded`,
  `  const handleRefundClick = () => {
    if (!permissions.canEditEnrollment || saveInFlight.current) return
    setRefundConfirmOpen(true)
  }

  const handleRefundConfirm = async () => {
    setRefundConfirmOpen(false)
    const newRefunded = !enrollment.refunded`
);

f = f.replace(
  "onClick={handleRefundToggle}",
  "onClick={handleRefundClick}"
);

// 10. Dialogs
f = f.replace(
  "        </div>\n      </div>\n    </div>",
  `        </div>
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
    </div>`
);

// 11. onChange replacements
f = f.replace(/onChange=\{e => setFormData\(prev => \(\{ \.\.\.prev, ([a-zA-Z0-9_]+): e\.target\.value \}\)\)\}/g, 'onChange={e => handleFieldChange("$1", e.target.value)}');

fs.writeFileSync('dashboard/src/components/enrollment/EnrollmentBillingDetailModal.jsx', f);
