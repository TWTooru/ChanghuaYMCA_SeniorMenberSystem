import React from 'react';

/**
 * 全域錯誤邊界：攔截子元件樹中的 runtime exception，
 * 避免整個應用程式白屏崩潰。
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '100vh', padding: '2rem', fontFamily: 'sans-serif',
          background: 'var(--bg-primary, #0b0f19)', color: 'var(--text-primary, #f3f4f6)',
        }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>系統發生錯誤</h1>
          <p style={{ color: 'var(--text-secondary, #9ca3af)', marginBottom: '1.5rem', textAlign: 'center' }}>
            很抱歉，系統遇到了無法處理的錯誤。請重新整理頁面再試一次。
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '0.75rem 1.5rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer',
              background: 'var(--color-accent, #6366f1)', color: '#fff', fontSize: '1rem',
            }}
          >
            重新整理頁面
          </button>
          {this.state.error && (
            <details style={{ marginTop: '2rem', maxWidth: '600px', width: '100%' }}>
              <summary style={{ cursor: 'pointer', color: 'var(--text-muted, #6b7280)' }}>錯誤詳情</summary>
              <pre style={{
                marginTop: '0.5rem', padding: '1rem', borderRadius: '0.5rem',
                background: 'var(--bg-card, #1f2937)', overflow: 'auto', fontSize: '0.8rem',
                color: 'var(--color-danger, #ef4444)',
              }}>
                {this.state.error.toString()}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
