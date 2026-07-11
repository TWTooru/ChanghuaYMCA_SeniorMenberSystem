import { useState, useMemo } from 'react'
import './App.css'
import { FileSpreadsheet, RefreshCw, Download, Activity, Users, Calendar, AlertCircle } from 'lucide-react'

import useApiData from './hooks/useApiData'
import OverviewTab from './components/overview/OverviewTab'
import StudentListTab from './components/students/StudentListTab'
import EnrollmentTab from './components/enrollment/EnrollmentTab'
import StudentDetailModal from './components/students/StudentDetailModal'
import AddStudentModal from './components/students/AddStudentModal'
import AddEnrollModal from './components/enrollment/AddEnrollModal'
import ExcelSync from './components/sync/ExcelSync'
import Login from './components/auth/Login'
import { useAuth } from './contexts/AuthContext'
import { exportToExcel } from './lib/excelExport'
import { normalizeEducation } from './domain/studentFields'

function App() {
  const { session } = useAuth()
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [showAddStudentModal, setShowAddStudentModal] = useState(false)
  const [showAddEnrollModal, setShowAddEnrollModal] = useState(false)
  const [refreshCount, setRefreshCount] = useState(0)

  const { dbData, dbStatus, dbError } = useApiData(session, refreshCount)
  const { students, enrollments } = dbData

  const stats = useMemo(() => {
    if (!students || students.length === 0) {
      return {
        totalStudents: 0, totalRegistrations: 0, activeS15: 0, totalRefunds: 0,
        males: 0, females: 0, ageGroups: {}, eduCounts: {}, popularCourses: []
      }
    }
    const totalStudents = students.length
    const totalRegistrations = enrollments.length
    
    const activeS15 = enrollments.filter(e => e.season === '第十五期' && !e.refunded).length
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
      totalStudents, totalRegistrations, activeS15, totalRefunds,
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
            <ExcelSync onSyncComplete={handleRefresh} />
            {dbStatus === 'connected' && (
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
              onClick={() => exportToExcel(
                students, 
                enrollments, 
                stats && stats.popularCourses ? stats.popularCourses.map(({name, count}) => ({Course: name, Count: count})) : [], 
                'export'
              )}
            >
              <Download size={18} />
              <span>下載整理版 Excel</span>
            </button>
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
    </div>
  )
}

export default App
