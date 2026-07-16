import { useState, useMemo, useEffect } from 'react'
import './App.css'
import { FileSpreadsheet, RefreshCw, Download, Activity, Users, Calendar, AlertCircle, LogOut, ShieldCheck } from 'lucide-react'

import useApiData from './hooks/useApiData'
import OverviewTab from './components/overview/OverviewTab'
import StudentListTab from './components/students/StudentListTab'
import EnrollmentTab from './components/enrollment/EnrollmentTab'
import StudentDetailModal from './components/students/StudentDetailModal'
import AddStudentModal from './components/students/AddStudentModal'
import AddEnrollModal from './components/enrollment/AddEnrollModal'
import ExcelSync from './components/sync/ExcelSync'
import ExportOptionsDialog from './components/sync/ExportOptionsDialog'
import Login from './components/auth/Login'
import PasswordSetup from './components/auth/PasswordSetup'
import AdminAccountPage from './components/admin/AdminAccountPage'
import { useAuth } from './contexts/AuthContext'
import usePermissions from './hooks/usePermissions'
import { exportToExcel } from './lib/excelExport'
import { normalizeEducation } from './domain/studentFields'

function AuthenticatedDashboard() {
  const { session, user, role, signOut } = useAuth()
  const permissions = usePermissions(role)
  const ROLE_LABELS = { admin: '管理員', editor: '編輯者', viewer: '檢視者' }
  const ROLE_COLORS = { admin: '#ef4444', editor: '#3b82f6', viewer: '#6b7280' }
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [showAddStudentModal, setShowAddStudentModal] = useState(false)
  const [showAddEnrollModal, setShowAddEnrollModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [refreshCount, setRefreshCount] = useState(0)

  useEffect(() => {
    if (role !== 'admin' && activeTab === 'admin') setActiveTab('overview')
  }, [role, activeTab])

  const { dbData, dbStatus, dbError } = useApiData(session, refreshCount)
  const { students, enrollments } = dbData

  const stats = useMemo(() => {
    if (!students || students.length === 0) {
      return {
        totalStudents: 0, totalRegistrations: 0, totalRefunds: 0,
        males: 0, females: 0, ageGroups: {}, eduCounts: {}, popularCourses: []
      }
    }
    const totalStudents = students.length
    const totalRegistrations = enrollments.length
    
    const totalRefunds = enrollments.filter(e => e.refunded).length
    
    const males = students.filter(s => s.gender === '男').length
    const females = students.filter(s => s.gender === '女').length
    
    const ageGroups = {
      '50歲以下': 0, '50-59歲': 0, '60-69歲': 0, '70-79歲': 0, '80歲以上': 0, '未知': 0
    }
    students.forEach(s => {
      const age = s.age
      if (!age) ageGroups['未知']++
      else if (age < 50) ageGroups['50歲以下']++
      else if (age >= 50 && age < 60) ageGroups['50-59歲']++
      else if (age >= 60 && age < 70) ageGroups['60-69歲']++
      else if (age >= 70 && age < 80) ageGroups['70-79歲']++
      else ageGroups['80歲以上']++
    })

    const eduCounts = {}
    students.forEach(s => {
      const cleanEdu = normalizeEducation(s.education)
      eduCounts[cleanEdu] = (eduCounts[cleanEdu] || 0) + 1
    })

    const courseCounts = {}
    enrollments.forEach(e => {
      if (!e.refunded) {
        e.courses.forEach(c => {
          courseCounts[c] = (courseCounts[c] || 0) + 1
        })
      }
    })
    
    const popularCourses = Object.entries(courseCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)

    return {
      totalStudents, totalRegistrations, totalRefunds,
      males, females, ageGroups, eduCounts, popularCourses
    }
  }, [students, enrollments])

  const handleRefresh = () => setRefreshCount(c => c + 1)

  if (!session) {
    return <Login />
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          <div className="header-title-area">
            <FileSpreadsheet size={32} className="header-icon" />
            <div>
              <h1 className="header-title">學員個人資料聯絡簿</h1>
              <p className="header-subtitle">資訊整理與智慧查詢系統 (SQLite 管理版)</p>
            </div>
            <div style={{ marginLeft: '12px', display: 'flex', alignItems: 'center' }}>
              <span className={`status-dot ${dbStatus === 'connected' ? 'dot-glowing-green' : (dbStatus === 'connecting' ? 'dot-orange' : 'dot-grey')}`}></span>
              <span style={{ fontSize: '12px', marginLeft: '6px', fontWeight: '500', color: dbStatus === 'connected' ? '#10b981' : '#9ca3af' }}>
                {dbStatus === 'connected' ? 'SQLite 資料庫已連線' : (dbStatus === 'connecting' ? '資料庫連線中...' : '離線模式 (載入靜態備份)')}
              </span>
            </div>
          </div>
          <div className="header-actions">
            {permissions.canSyncExcel && <ExcelSync onSyncComplete={handleRefresh} />}
            {permissions.canRefreshSync && dbStatus === 'connected' && (
              <button 
                type="button"
                className="btn-secondary" 
                style={{ display: 'flex', gap: '6px', alignItems: 'center' }}
                onClick={handleRefresh}
              >
                <RefreshCw size={14} className={dbStatus === 'connecting' ? 'spin' : ''} />
                <span>整理同步</span>
              </button>
            )}
            <button 
              className="btn-primary" 
              id="btn-download-excel"
              onClick={() => setShowExportModal(true)}
            >
              <Download size={18} />
              <span>下載整理版 Excel</span>
            </button>
            <div className="header-user-info">
              <span className="header-user-email">{user?.email}</span>
              <span className="header-role-badge" style={{ backgroundColor: ROLE_COLORS[role] || '#6b7280' }}>
                {ROLE_LABELS[role] || '檢視者'}
              </span>
              <button type="button" className="btn-logout" onClick={signOut} title="登出">
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {dbStatus === 'offline' && (
        <div className="offline-banner">
          <AlertCircle size={16} />
          <span>{dbError}</span>
        </div>
      )}

      <nav className="tabs-nav">
        <div className="tabs-container">
          <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')} id="tab-overview">
            <Activity size={18} /><span>數據概覽</span>
          </button>
          <button className={`tab-btn ${activeTab === 'students' ? 'active' : ''}`} onClick={() => setActiveTab('students')} id="tab-students">
            <Users size={18} /><span>學員清單與查詢</span>
          </button>
          <button className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')} id="tab-history">
            <Calendar size={18} /><span>歷年選課歷程</span>
          </button>
          {role === 'admin' && (
            <button className={`tab-btn ${activeTab === 'admin' ? 'active' : ''}`} onClick={() => setActiveTab('admin')} id="tab-admin">
              <ShieldCheck size={18} /><span>帳號管理</span>
            </button>
          )}
        </div>
      </nav>

      <main className="app-main">
        {activeTab === 'overview' && <OverviewTab students={students} stats={stats} />}
        {activeTab === 'students' && (
          <StudentListTab 
            students={students} 
            enrollments={enrollments} 
            onSelectStudent={setSelectedStudent} 
            onShowAddStudent={() => setShowAddStudentModal(true)} 
          />
        )}
        {activeTab === 'history' && (
          <EnrollmentTab 
            students={students} 
            enrollments={enrollments} 
            onSelectStudent={setSelectedStudent} 
          />
        )}
        {activeTab === 'admin' && role === 'admin' && <AdminAccountPage />}
      </main>

      <footer className="app-footer">
        <p>© 2026 YMCA 樂齡健康活力中心 學員資訊管理系統 - 本系統供行政查詢與分析統計使用</p>
      </footer>

      {selectedStudent && (
        <StudentDetailModal 
          student={selectedStudent} 
          enrollments={enrollments} 
          onClose={() => setSelectedStudent(null)} 
          onAddEnrollment={() => setShowAddEnrollModal(true)}
          onRefresh={handleRefresh}
        />
      )}
      
      {showAddStudentModal && (
        <AddStudentModal 
          students={students} 
          onClose={() => setShowAddStudentModal(false)} 
          onRefresh={handleRefresh} 
        />
      )}
      
      {showAddEnrollModal && selectedStudent && (
        <AddEnrollModal 
          student={selectedStudent} 
          onClose={() => setShowAddEnrollModal(false)} 
          onRefresh={handleRefresh} 
        />
      )}
      
      {showExportModal && (
        <ExportOptionsDialog 
          students={students}
          enrollments={enrollments}
          onCancel={() => setShowExportModal(false)}
          onExport={({ exportScope, selectedSeason, options }) => {
            setShowExportModal(false)
            
            let exportStudents = students
            let exportEnrollments = enrollments
            
            if (exportScope === 'season') {
              exportEnrollments = enrollments.filter(e => e.season === selectedSeason)
              const enrolledIds = new Set(exportEnrollments.map(e => String(e.student_id)))
              exportStudents = students.filter(s => enrolledIds.has(String(s.student_id)))
            }
            
            // Recompute course counts for the exported selection
            const courseCounts = {}
            exportEnrollments.forEach(e => {
              if (!e.refunded) {
                e.courses.forEach(c => {
                  courseCounts[c] = (courseCounts[c] || 0) + 1
                })
              }
            })
            const exportCourses = Object.entries(courseCounts)
              .map(([name, count]) => ({ Course: name, Count: count }))
              .sort((a, b) => b.Count - a.Count)
            
            const filename = exportScope === 'season' ? `YMCA_export_${selectedSeason}.xlsx` : 'YMCA_export_all.xlsx'
            
            exportToExcel(exportStudents, exportEnrollments, exportCourses, filename, options)
          }}
        />
      )}
    </div>
  )
}

function App() {
  const { session, passwordFlow, completePasswordFlow } = useAuth()

  if (passwordFlow) {
    return <PasswordSetup session={session} flow={passwordFlow} onComplete={completePasswordFlow} />
  }

  if (!session) {
    return <Login />
  }

  return <AuthenticatedDashboard />
}

export default App
