import { FileSpreadsheet, RefreshCw, Download, LogOut } from 'lucide-react'

const ROLE_LABELS = { admin: '管理員', editor: '編輯者', viewer: '檢視者' }
const ROLE_COLORS = { admin: '#ef4444', editor: '#3b82f6', viewer: '#6b7280' }

export default function AppHeader({ dbStatus, permissions, user, role, onRefresh, onShowExportModal, onSignOut, syncSlot }) {
  return (
    <header className="app-header">
      <div className="header-content">
        <div className="header-title-area">
          <FileSpreadsheet size={32} className="header-icon" />
          <div>
            <h1 className="header-title">學員個人資料聯絡簿</h1>
            <p className="header-subtitle">資訊整理與智慧查詢系統</p>
          </div>
          <div style={{ marginLeft: '12px', display: 'flex', alignItems: 'center' }}>
            <span className={`status-dot ${dbStatus === 'connected' ? 'dot-glowing-green' : (dbStatus === 'connecting' ? 'dot-orange' : 'dot-grey')}`}></span>
            <span style={{ fontSize: '12px', marginLeft: '6px', fontWeight: '500', color: dbStatus === 'connected' ? '#10b981' : '#9ca3af' }}>
              {dbStatus === 'connected' ? 'Supabase 資料庫已連線' : (dbStatus === 'connecting' ? '資料庫連線中...' : '離線模式 (載入靜態備份)')}
            </span>
          </div>
        </div>
        <div className="header-actions">
          {syncSlot}
          {permissions.canRefreshSync && dbStatus === 'connected' && (
            <button 
              type="button"
              className="btn-secondary" 
              style={{ display: 'flex', gap: '6px', alignItems: 'center' }}
              onClick={onRefresh}
            >
              <RefreshCw size={14} className={dbStatus === 'connecting' ? 'spin' : ''} />
              <span>整理同步</span>
            </button>
          )}
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
