import { useEffect, useRef, useState } from 'react'
import { LogOut, RefreshCw, ShieldAlert } from 'lucide-react'
import './auth.css'

const ROLE_ERROR_MESSAGES = {
  ROLE_NOT_ASSIGNED: '此帳號尚未設定系統角色，請聯絡最高管理員。',
  ROLE_STORE_ERROR: '目前無法確認帳號權限，請稍後重試。',
}

export default function RoleAccessState({ status, errorCode, onRetry, onSignOut }) {
  const [isRetrying, setIsRetrying] = useState(false)
  const mountedRef = useRef(true)
  const retryingRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const handleRetry = async () => {
    if (retryingRef.current) return
    retryingRef.current = true
    setIsRetrying(true)

    try {
      await onRetry?.()
    } catch {
      // AuthContext owns the public, fail-closed error state; never expose store details here.
    } finally {
      retryingRef.current = false
      if (mountedRef.current) setIsRetrying(false)
    }
  }

  const handleSignOut = () => {
    try {
      void Promise.resolve(onSignOut?.()).catch(() => {})
    } catch {
      // Signing out already clears local access; remote errors remain private.
    }
  }

  const isLoading = status === 'loading'
  const message = isLoading
    ? '正在確認帳號權限，請稍候。'
    : ROLE_ERROR_MESSAGES[errorCode] || ROLE_ERROR_MESSAGES.ROLE_STORE_ERROR

  return (
    <main className="role-access-page" data-testid="role-access-state">
      <section className="role-access-card" aria-live="polite">
        <ShieldAlert size={34} aria-hidden="true" />
        <h1>{isLoading ? '正在確認權限' : '無法進入系統'}</h1>
        <p>{message}</p>
        <div className="role-access-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={handleRetry}
            disabled={isLoading || isRetrying}
          >
            <RefreshCw size={17} className={isLoading || isRetrying ? 'spin' : undefined} />
            重試
          </button>
          <button type="button" className="btn-secondary" onClick={handleSignOut}>
            <LogOut size={17} />
            登出
          </button>
        </div>
      </section>
    </main>
  )
}
