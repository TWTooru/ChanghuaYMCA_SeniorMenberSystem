import { useState, useCallback } from 'react'

export default function useUnsavedChangesGuard() {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [pendingAction, setPendingAction] = useState(null)

  const requestAction = useCallback((action) => {
    if (!hasUnsavedChanges) {
      action()
    } else {
      setPendingAction(() => action)
    }
  }, [hasUnsavedChanges])

  const confirmPendingAction = useCallback(() => {
    if (pendingAction) {
      pendingAction()
      setPendingAction(null)
      setHasUnsavedChanges(false)
    }
  }, [pendingAction])

  const cancelPendingAction = useCallback(() => {
    setPendingAction(null)
  }, [])

  return {
    hasUnsavedChanges,
    setHasUnsavedChanges,
    pendingAction,
    requestAction,
    confirmPendingAction,
    cancelPendingAction,
  }
}
