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

const SENSITIVE_ERROR_CODES = new Set(['UNAUTHENTICATED', 'FORBIDDEN'])

function getErrorCode(error) {
  return error?.code || 'UNKNOWN_ERROR'
}

export default function useAdminUsers() {
  const [users, setUsers] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [mutation, setMutation] = useState(null)
  const [errorCode, setErrorCode] = useState(null)
  const refreshId = useRef(0)
  const authorizationGeneration = useRef(0)
  const mutationId = useRef(0)
  const activeMutations = useRef(new Map())

  const handleError = useCallback(error => {
    const code = getErrorCode(error)
    if (SENSITIVE_ERROR_CODES.has(code)) {
      setUsers([])
      setAuditLogs([])
    }
    setErrorCode(code)
  }, [])

  const refresh = useCallback(async () => {
    const requestId = ++refreshId.current
    const requestGeneration = ++authorizationGeneration.current
    setLoading(true)
    setErrorCode(null)
    let handledError = false
    try {
      const [usersResult, auditLogsResult] = await Promise.all([listUsers(), listAuditLogs()])
      if (requestId !== refreshId.current) return
      setUsers(usersResult.users || [])
      setAuditLogs(auditLogsResult.auditLogs || [])
    } catch (error) {
      if (requestId !== refreshId.current || requestGeneration !== authorizationGeneration.current) return
      const code = getErrorCode(error)
      if (SENSITIVE_ERROR_CODES.has(code)) refreshId.current += 1
      handleError(error)
      handledError = true
    } finally {
      if (handledError || requestId === refreshId.current) setLoading(false)
    }
  }, [handleError])

  useEffect(() => {
    refresh()
  }, [refresh])

  const runMutation = useCallback(async (key, action) => {
    const operationId = ++mutationId.current
    const operationGeneration = authorizationGeneration.current
    activeMutations.current.set(operationId, key)
    setMutation(key)
    setErrorCode(null)
    try {
      await action()
      await refresh()
      return true
    } catch (error) {
      if (operationGeneration !== authorizationGeneration.current) return false
      if (SENSITIVE_ERROR_CODES.has(getErrorCode(error))) refreshId.current += 1
      handleError(error)
      return false
    } finally {
      activeMutations.current.delete(operationId)
      const activeKeys = Array.from(activeMutations.current.values())
      setMutation(activeKeys.at(-1) || null)
    }
  }, [handleError, refresh])

  const invite = useCallback((email, role) => runMutation('invite', () => inviteUser(email, role)), [runMutation])
  const changeRole = useCallback((userId, role) => runMutation(`role:${userId}`, () => updateRole(userId, role)), [runMutation])
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
