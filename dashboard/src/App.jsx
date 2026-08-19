import { useState, useEffect } from 'react'
import './App.css'
import { Activity, Users, Calendar, AlertCircle, ShieldCheck, BookOpen, CircleHelp } from 'lucide-react'

import useApiData from './hooks/useApiData'
import useStats from './hooks/useStats'
import useExportHandler from './hooks/useExportHandler'
import useStudentSelection from './hooks/useStudentSelection'
import OverviewTab from './components/overview/OverviewTab'
import StudentListTab from './components/students/StudentListTab'
import EnrollmentTab from './components/enrollment/EnrollmentTab'
import EnrollmentBillingDetailModal from './components/enrollment/EnrollmentBillingDetailModal'
import StudentDetailModal from './components/students/StudentDetailModal'
import AddStudentModal from './components/students/AddStudentModal'
import AddEnrollModal from './components/enrollment/AddEnrollModal'
import ExcelSync from './components/sync/ExcelSync'
import ExportOptionsDialog from './components/sync/ExportOptionsDialog'
import Login from './components/auth/Login'
import PasswordSetup from './components/auth/PasswordSetup'
import AdminAccountPage from './components/admin/AdminAccountPage'
import CourseManagementTab from './components/courses/CourseManagementTab'
import FaqTab from './components/faq/FaqTab'
import { useAuth } from './contexts/AuthContext'
import usePermissions from './hooks/usePermissions'
import useTheme from './hooks/useTheme'
import AppHeader from './components/common/AppHeader'
import QuickSearch from './components/common/QuickSearch'

/**
 * 應用程式組合根節點：依認證流程切換登入／設密碼畫面，登入後再串接
 * dashboard 資料、頁籤與跨頁共用 modal。`refreshCount` 是所有成功 mutation
 * 通知 `useApiData` 重新讀取 Supabase 快照的唯一入口。
 */
function AuthenticatedDashboard() {
  const { session, user, role, signOut } = useAuth()
  const permissions = usePermissions(role)
  const { theme, toggleTheme } = useTheme()
  const [activeTab, setActiveTab] = useState('overview')
  const [showAddStudentModal, setShowAddStudentModal] = useState(false)
  const [showAddEnrollModal, setShowAddEnrollModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showQuickSearch, setShowQuickSearch] = useState(false)
  const [selectedBillingRecord, setSelectedBillingRecord] = useState(null)
  const [refreshCount, setRefreshCount] = useState(0)

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setShowQuickSearch(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // 角色可能在 session 更新後降級；立即退出管理頁，避免保留已失效的管理介面。
  useEffect(() => {
    if (role !== 'admin' && (activeTab === 'admin' || activeTab === 'courses' || activeTab === 'question')) setActiveTab('overview')
  }, [role, activeTab])

  const { dbData, dbStatus, dbError } = useApiData(session, refreshCount)
  const { students, enrollments } = dbData
  const selectedBillingStudent = selectedBillingRecord
    ? students.find(student => String(student.student_id) === String(selectedBillingRecord.studentId))
    : null
  const selectedBillingEnrollment = selectedBillingRecord
    ? enrollments.find(enrollment => String(enrollment.enrollment_id) === String(selectedBillingRecord.enrollmentId))
    : null

  const stats = useStats(students, enrollments)
  const handleExport = useExportHandler(students, enrollments)
  const {
    selectedStudent, studentDetailInitialTab, studentDetailIsTabbed,
    openStudentDetail, closeStudentDetail, replaceSelectedStudent
  } = useStudentSelection(students)

  const handleRefresh = () => setRefreshCount(c => c + 1)

  if (!session) {
    return <Login />
  }

  return (
    <div className="app-container">
      <AppHeader
        dbStatus={dbStatus}
        permissions={permissions}
        user={user}
        role={role}
        onRefresh={handleRefresh}
        onShowExportModal={() => setShowExportModal(true)}
        onSignOut={signOut}
        syncSlot={permissions.canSyncExcel ? <ExcelSync onSyncComplete={handleRefresh} /> : null}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

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
            <button className={`tab-btn ${activeTab === 'courses' ? 'active' : ''}`} onClick={() => setActiveTab('courses')} id="tab-courses">
              <BookOpen size={18} /><span>課程管理</span>
            </button>
          )}
          {role === 'admin' && (
            <button className={`tab-btn ${activeTab === 'admin' ? 'active' : ''}`} onClick={() => setActiveTab('admin')} id="tab-admin">
              <ShieldCheck size={18} /><span>帳號管理</span>
            </button>
          )}
          {role === 'admin' && (
            <button className={`tab-btn ${activeTab === 'question' ? 'active' : ''}`} onClick={() => setActiveTab('question')} id="tab-question">
              <CircleHelp size={18} /><span>疑難雜症</span>
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
            onSelectStudent={openStudentDetail}
            onShowAddStudent={() => setShowAddStudentModal(true)} 
            onRefresh={handleRefresh}
          />
        )}
        {activeTab === 'history' && (
          <EnrollmentTab 
            students={students} 
            enrollments={enrollments} 
            onSelectEnrollment={(student, enrollment) => {
              setSelectedBillingRecord({
                studentId: student.student_id,
                enrollmentId: enrollment.enrollment_id,
              })
            }}
          />
        )}
        {activeTab === 'courses' && role === 'admin' && <CourseManagementTab />}
        {activeTab === 'admin' && role === 'admin' && <AdminAccountPage />}
        {activeTab === 'question' && role === 'admin' && <FaqTab />}
      </main>

      <footer className="app-footer">
        <p>© 2026 YMCA社教學員資料庫 學員資訊管理系統 - 本系統供行政查詢與分析統計使用</p>
      </footer>

      {selectedBillingStudent && selectedBillingEnrollment && (
        <EnrollmentBillingDetailModal
          student={selectedBillingStudent}
          enrollment={selectedBillingEnrollment}
          onClose={() => setSelectedBillingRecord(null)}
          onRefresh={handleRefresh}
        />
      )}

      {selectedStudent && (
        <StudentDetailModal 
          student={selectedStudent} 
          enrollments={enrollments} 
          initialTab={studentDetailInitialTab}
          isTabbed={studentDetailIsTabbed}
          onClose={closeStudentDetail} 
          onAddEnrollment={() => setShowAddEnrollModal(true)}
          onRefresh={handleRefresh}
          onStudentUpdated={replaceSelectedStudent}
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
          enrollments={enrollments}
          onCancel={() => setShowExportModal(false)}
          onExport={(params) => {
            setShowExportModal(false)
            handleExport(params)
          }}
        />
      )}

      {showQuickSearch && (
        <QuickSearch
          students={students}
          onSelect={student => openStudentDetail(student, 'profile', true)}
          onClose={() => setShowQuickSearch(false)}
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
