import React from 'react'

export default class ErrorBoundary extends React.Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo)
  }

  handleReload = () => {
    if (this.props.onReload) this.props.onReload()
    else window.location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main className="app-error-boundary" role="alert">
        <h1>系統發生錯誤</h1>
        <p>系統暫時無法載入，請重新載入頁面後再試一次。</p>
        <button type="button" className="btn-primary" onClick={this.handleReload}>重新載入頁面</button>
        <details>
          <summary>錯誤詳細資訊</summary>
          <pre>{String(this.state.error)}</pre>
        </details>
      </main>
    )
  }
}
