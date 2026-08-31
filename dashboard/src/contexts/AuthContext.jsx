import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { detectPasswordFlow } from '../lib/authFlow'
import { initialPasswordFlow, supabase } from '../lib/supabaseClient'
import { fetchStoredRole } from '../services/roleService'

export { detectPasswordFlow } from '../lib/authFlow'

const CLEARED_ROLE_STATE = {
  role: null,
  status: 'unassigned',
  errorCode: null,
}

const AuthContext = createContext({
  session: null,
  user: null,
  role: null,
  roleStatus: 'loading',
  roleErrorCode: null,
  refreshRole: async () => null,
  loading: true,
  signOut: async () => {},
  passwordFlow: null,
  completePasswordFlow: () => {},
})

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [roleState, setRoleState] = useState({
    role: null,
    status: 'loading',
    errorCode: null,
  })
  const [passwordFlow, setPasswordFlow] = useState(
    () => initialPasswordFlow ?? detectPasswordFlow(window.location),
  )

  const mountedRef = useRef(false)
  const sessionRef = useRef(null)
  const sessionGenerationRef = useRef(0)
  const roleRequestIdRef = useRef(0)

  const clearRole = useCallback(() => {
    roleRequestIdRef.current += 1
    if (mountedRef.current) setRoleState(CLEARED_ROLE_STATE)
  }, [])

  const loadRole = useCallback(async (userId) => {
    const requestId = roleRequestIdRef.current + 1
    roleRequestIdRef.current = requestId

    if (!mountedRef.current) return null
    setRoleState({ role: null, status: 'loading', errorCode: null })

    try {
      const storedRole = await fetchStoredRole(supabase, userId)
      if (!mountedRef.current || requestId !== roleRequestIdRef.current) return null

      setRoleState({ role: storedRole, status: 'ready', errorCode: null })
      return storedRole
    } catch (error) {
      if (!mountedRef.current || requestId !== roleRequestIdRef.current) return null

      const isUnassigned = error?.code === 'ROLE_NOT_ASSIGNED'
      setRoleState({
        role: null,
        status: isUnassigned ? 'unassigned' : 'error',
        errorCode: isUnassigned ? 'ROLE_NOT_ASSIGNED' : 'ROLE_STORE_ERROR',
      })
      return null
    }
  }, [])

  const applySession = useCallback((nextSession) => {
    sessionGenerationRef.current += 1
    if (!mountedRef.current) return Promise.resolve(null)

    sessionRef.current = nextSession
    setSession(nextSession)
    setSessionLoading(false)

    if (!nextSession) {
      clearRole()
      return Promise.resolve(null)
    }

    return loadRole(nextSession.user?.id)
  }, [clearRole, loadRole])

  useEffect(() => {
    mountedRef.current = true
    const initialGeneration = sessionGenerationRef.current

    const initializeSession = async () => {
      try {
        const result = await supabase.auth.getSession()
        if (!mountedRef.current || initialGeneration !== sessionGenerationRef.current) return
        await applySession(result?.data?.session ?? null)
      } catch {
        if (!mountedRef.current || initialGeneration !== sessionGenerationRef.current) return
        await applySession(null)
      }
    }

    void initializeSession()

    const authState = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mountedRef.current) return
      if (event === 'TOKEN_REFRESHED') return
      // Supabase 在切回分頁時會因 visibilitychange 觸發 SIGNED_IN，
      // 若使用者身份沒變就跳過，避免整頁資料重新載入。
      if (
        event === 'SIGNED_IN'
        && sessionRef.current?.user?.id
        && nextSession?.user?.id === sessionRef.current.user.id
      ) {
        sessionRef.current = nextSession
        return
      }
      if (event === 'PASSWORD_RECOVERY') setPasswordFlow('recovery')
      void applySession(nextSession)
    })
    const subscription = authState?.data?.subscription

    return () => {
      mountedRef.current = false
      sessionGenerationRef.current += 1
      roleRequestIdRef.current += 1
      subscription?.unsubscribe()
    }
  }, [applySession])

  const refreshRole = useCallback(() => {
    const currentUser = sessionRef.current?.user
    if (!currentUser) {
      clearRole()
      return Promise.resolve(null)
    }
    return loadRole(currentUser.id)
  }, [clearRole, loadRole])

  const signOut = useCallback(async () => {
    applySession(null)
    return supabase.auth.signOut()
  }, [applySession])

  const completePasswordFlow = useCallback(() => {
    const basePath = window.location.pathname.replace(/\/set-password\/?$/, '') || '/'
    window.history.replaceState({}, document.title, basePath)
    setPasswordFlow(null)
  }, [])

  const user = session?.user ?? null
  const role = roleState.status === 'ready' ? roleState.role : null
  const loading = sessionLoading || roleState.status === 'loading'

  const value = useMemo(
    () => ({
      session,
      user,
      role,
      roleStatus: roleState.status,
      roleErrorCode: roleState.errorCode,
      refreshRole,
      loading,
      signOut,
      passwordFlow,
      completePasswordFlow,
    }),
    [
      session,
      user,
      role,
      roleState.status,
      roleState.errorCode,
      refreshRole,
      loading,
      signOut,
      passwordFlow,
      completePasswordFlow,
    ],
  )

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
