import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import './auth.css'

const UPDATE_ERROR = '密碼設定失敗，請重新開啟連結後再試一次。'

export default function PasswordSetup({ session, flow, onComplete }) {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const isTooShort = password.length > 0 && password.length < 8
  const doesNotMatch = confirmation.length > 0 && password !== confirmation
  const canSubmit = password.length >= 8 && password === confirmation && !busy

  if (!session) {
    return (
      <main className="password-setup-page">
        <section className="password-setup-card">
          <h1>設定密碼</h1>
          <p>此連結已失效或已過期，請重新取得設定密碼連結。</p>
          <button type="button" className="btn-primary" onClick={onComplete}>返回登入頁</button>
        </section>
      </main>
    )
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (updateError) {
      setError(UPDATE_ERROR)
      return
    }
    setPassword('')
    setConfirmation('')
    onComplete()
  }

  return (
    <main className="password-setup-page">
      <section className="password-setup-card">
        <h1>{flow === 'recovery' ? '重設密碼' : '設定密碼'}</h1>
        <p>請設定至少 8 個字元的新密碼。</p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="password-setup-password">新密碼</label>
          <input id="password-setup-password" type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} required />
          {isTooShort && <p className="password-setup-error">密碼至少需要 8 個字元。</p>}
          <label htmlFor="password-setup-confirmation">確認新密碼</label>
          <input id="password-setup-confirmation" type="password" minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={busy} required />
          {doesNotMatch && <p className="password-setup-error">兩次輸入的密碼不一致。</p>}
          {error && <p className="password-setup-error" role="alert">{error}</p>}
          <button type="submit" className="btn-primary" disabled={!canSubmit}>{busy ? '設定中…' : '設定密碼'}</button>
        </form>
      </section>
    </main>
  )
}
