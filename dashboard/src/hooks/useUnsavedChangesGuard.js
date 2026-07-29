import { useState, useCallback } from 'react'

/**
 * 統一管理表單 dirty state 與 modal 關閉／捨棄變更確認。
 * 呼叫端必須在每次成功儲存後清除 dirty state。
 */
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
