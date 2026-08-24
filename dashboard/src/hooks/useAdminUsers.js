import { useCallback, useEffect, useRef, useState } from 'react'
import {
  deleteUser,
  inviteUser,
  listAuditLogs,
  listUsers,
  resendInvite,
  sendPasswordReset,
  updateRole,
} from '../services/adminUserService'

const SENSITIVE_ERROR_CODES = new Set([
  'ROLE_NOT_ASSIGNED',
  'ROLE_STORE_ERROR',
  'FORBIDDEN',
  'UNAUTHENTICATED',
])

function getErrorCode(error) {
  return error?.code || 'UNKNOWN_ERROR'
}

/**
 * 協調帳號清單、audit log 與帳號 mutation。request/generation ID 會阻擋過期回應；
 * 操作者角色或角色儲存失效時，既有敏感資料會立即清除且不允許舊回應寫回。
 */
export default function useAdminUsers() {
  const [users, setUsers] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [mutation, setMutation] = useState(null)
  const [errorCode, setErrorCode] = useState(null)
  const mounted = useRef(false)
  const refreshId = useRef(0)
  const authorizationGeneration = useRef(0)
  const mutationId = useRef(0)
  const activeMutations = useRef(new Map())

  const handleError = useCallback(error => {
    if (!mounted.current) return false

    const code = getErrorCode(error)
    if (SENSITIVE_ERROR_CODES.has(code)) {
      authorizationGeneration.current += 1
      refreshId.current += 1
      activeMutations.current.clear()
      setUsers([])
      setAuditLogs([])
      setLoading(false)
      setMutation(null)
    }
    setErrorCode(code)
    return true
  }, [])

  const refresh = useCallback(async () => {
    if (!mounted.current) return false

    const requestId = ++refreshId.current
    const requestGeneration = ++authorizationGeneration.current
    setLoading(true)
    setErrorCode(null)
    let handledError = false

    try {
      const [usersResult, auditLogsResult] = await Promise.all([listUsers(), listAuditLogs()])
      if (
        !mounted.current
        || requestId !== refreshId.current
        || requestGeneration !== authorizationGeneration.current
      ) return false

      setUsers(usersResult.users || [])
      setAuditLogs(auditLogsResult.auditLogs || [])
      return true
    } catch (error) {
      if (
        !mounted.current
        || requestId !== refreshId.current
        || requestGeneration !== authorizationGeneration.current
      ) return false

      handledError = handleError(error)
      return false
    } finally {
      if (
        mounted.current
        && (
          handledError
          || (requestId === refreshId.current && requestGeneration === authorizationGeneration.current)
        )
      ) setLoading(false)
    }
  }, [handleError])

  useEffect(() => {
    const activeMutationMap = activeMutations.current
    mounted.current = true
    void refresh()

    return () => {
      mounted.current = false
      refreshId.current += 1
      authorizationGeneration.current += 1
      activeMutationMap.clear()
    }
  }, [refresh])

  const runMutation = useCallback(async (key, action, options = {}) => {
    if (!mounted.current) return false

    const operationId = ++mutationId.current
    const operationGeneration = authorizationGeneration.current
    activeMutations.current.set(operationId, key)
    setMutation(key)
    setErrorCode(null)

    try {
      const result = await action()
      if (!mounted.current || operationGeneration !== authorizationGeneration.current) return false

      options.applyResult?.(result)
      if (options.refreshAfter !== false) await refresh()
      return true
    } catch (error) {
      if (!mounted.current || operationGeneration !== authorizationGeneration.current) return false
      handleError(error)
      return false
    } finally {
      activeMutations.current.delete(operationId)
      if (mounted.current) {
        const activeKeys = Array.from(activeMutations.current.values())
        setMutation(activeKeys.at(-1) || null)
      }
    }
  }, [handleError, refresh])

  const invite = useCallback(email => runMutation('invite', () => inviteUser(email)), [runMutation])
  const changeRole = useCallback((userId, role) => runMutation(
    `role:${userId}`,
    () => updateRole(userId, role),
    {
      refreshAfter: false,
      applyResult: result => {
        const serverUser = result?.user
        if (!serverUser?.id) return
        setUsers(currentUsers => currentUsers.map(user => (
          user.id === serverUser.id ? serverUser : user
        )))
      },
    },
  ), [runMutation])
  const resend = useCallback(userId => runMutation(`resend:${userId}`, () => resendInvite(userId)), [runMutation])
  const resetPassword = useCallback(userId => runMutation(`reset:${userId}`, () => sendPasswordReset(userId)), [runMutation])
  const remove = useCallback((userId, confirmEmail) => runMutation(`delete:${userId}`, () => deleteUser(userId, confirmEmail)), [runMutation])

  return {
    users,
    auditLogs,
    loading,
    mutation,
    errorCode,
    refresh,
    invite,
    changeRole,
    resend,
    resetPassword,
    remove,
  }
}
