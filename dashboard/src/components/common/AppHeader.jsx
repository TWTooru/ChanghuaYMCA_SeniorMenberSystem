import { FileSpreadsheet, RefreshCw, Download, LogOut, Sun, Moon } from 'lucide-react'

const ROLE_LABELS = { owner: '最高管理員', admin: '管理員', editor: '編輯者', viewer: '檢視者' }
const ROLE_COLORS = { owner: '#7c3aed', admin: '#ef4444', editor: '#3b82f6', viewer: '#6b7280' }

/** 集中呈現連線狀態、依權限顯示的全域操作、使用者資訊與主題／登出控制。 */
export default function AppHeader({
  dbStatus,
  permissions,
  user,
  role,
  onRefresh,
  onShowExportModal,
  onSignOut,
  syncSlot,
  theme = 'dark',
  onToggleTheme
}) {
  return (
    <header className="app-header">
      <div className="header-content">
        <div className="header-title-area">
          <FileSpreadsheet size={32} className="header-icon" />
          <div>
            <h1 className="header-title">YMCA社教學員聯絡簿</h1>
            <p className="header-subtitle">資訊整理與智慧查詢系統</p>
          </div>
          <div style={{ marginLeft: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span className={`status-dot ${dbStatus === 'connected' ? 'dot-glowing-green' : (dbStatus === 'connecting' ? 'dot-orange' : 'dot-grey')}`}></span>
              <span style={{ fontSize: '12px', marginLeft: '6px', fontWeight: '500', color: dbStatus === 'connected' ? '#10b981' : '#9ca3af' }}>
                {dbStatus === 'connected' ? 'Supabase 資料庫已連線' : (dbStatus === 'connecting' ? '資料庫連線中...' : '目前離線，無法載入資料')}
              </span>
            </div>
            {permissions?.canRefreshSync && dbStatus === 'connected' && (
              <button 
                type="button"
                className="btn-refresh-inline" 
                onClick={onRefresh}
                title="整理同步"
                id="btn-refresh-sync-inline"
              >
                <RefreshCw size={12} className={dbStatus === 'connecting' ? 'spin' : ''} />
                <span>整理同步</span>
              </button>
            )}
          </div>
        </div>
        <div className="header-actions">
          {syncSlot}
          <button 
            type="button"
            className="btn-theme-toggle" 
            onClick={onToggleTheme}
            title={theme === 'dark' ? '切換至明亮模式' : '切換至黑暗模式'}
            aria-label={theme === 'dark' ? '切換至明亮模式' : '切換至黑暗模式'}
            id="btn-theme-toggle"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button 
            className="btn-primary" 
            id="btn-download-excel"
            onClick={onShowExportModal}
          >
            <Download size={18} />
            <span>下載整理版 Excel</span>
          </button>
          <div className="header-user-info">
            <span className="header-user-email">{user?.email}</span>
            <span className="header-role-badge" style={{ backgroundColor: ROLE_COLORS[role] || '#6b7280' }}>
              {ROLE_LABELS[role] || '檢視者'}
            </span>
            <button type="button" className="btn-logout" onClick={onSignOut} title="登出">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
