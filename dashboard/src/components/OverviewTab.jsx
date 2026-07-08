import {
  Users, BookOpen, UserCheck, DollarSign,
  TrendingUp, Award, FileText
} from 'lucide-react'

export default function OverviewTab({ students, stats }) {
  return (
    <div>
      {/* KPI Section */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon-wrapper purple"><Users size={24} /></div>
          <div>
            <div className="kpi-label">累計服務學員</div>
            <div className="kpi-value-area">
              <span className="kpi-value">{stats.totalStudents}</span>
              <span className="kpi-unit">人</span>
            </div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon-wrapper emerald"><BookOpen size={24} /></div>
          <div>
            <div className="kpi-label">累計選課總人次</div>
            <div className="kpi-value-area">
              <span className="kpi-value">{stats.totalRegistrations}</span>
              <span className="kpi-unit">人次</span>
            </div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon-wrapper cyan"><UserCheck size={24} /></div>
          <div>
            <div className="kpi-label">第15期在修學員</div>
            <div className="kpi-value-area">
              <span className="kpi-value">{stats.activeS15}</span>
              <span className="kpi-unit">人</span>
            </div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon-wrapper amber"><DollarSign size={24} /></div>
          <div>
            <div className="kpi-label">累計退費記錄</div>
            <div className="kpi-value-area">
              <span className="kpi-value">{stats.totalRefunds}</span>
              <span className="kpi-unit">人次</span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="overview-grid">
        <div className="panel-card">
          <h3 className="panel-title">
            <TrendingUp size={18} className="header-icon" />
            學員年齡層分佈 (統計人數：{students.filter(s => s.age).length}人)
          </h3>
          <div className="bar-chart-container">
            {Object.entries(stats.ageGroups).map(([label, count]) => {
              const maxVal = Math.max(...Object.values(stats.ageGroups))
              const percentage = maxVal > 0 ? (count / maxVal) * 100 : 0
              const pctOfTotal = students.length > 0 ? (count / students.length) * 100 : 0
              return (
                <div className="chart-bar-row" key={label}>
                  <div className="chart-bar-label">{label}</div>
                  <div className="chart-bar-track">
                    <div className="chart-bar-fill" style={{ width: `${percentage}%` }}></div>
                  </div>
                  <div className="chart-bar-value">{count}人 ({pctOfTotal.toFixed(0)}%)</div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="panel-card" style={{ flex: 1 }}>
            <h3 className="panel-title">
              <Award size={18} className="header-icon" />
              教育程度分佈
            </h3>
            <div className="distribution-list">
              {Object.entries(stats.eduCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([edu, count]) => {
                  const pct = stats.totalStudents > 0 ? (count / stats.totalStudents) * 100 : 0
                  return (
                    <div className="dist-item" key={edu}>
                      <span className="dist-label">{edu}</span>
                      <div className="dist-value-group">
                        <span className="dist-percentage-pill">{pct.toFixed(1)}%</span>
                        <span className="dist-value">{count}人</span>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>

          <div className="panel-card" style={{ flex: 1 }}>
            <h3 className="panel-title">
              <FileText size={18} className="header-icon" />
              最熱門課程項目
            </h3>
            <div className="distribution-list">
              {stats.popularCourses.map((c, idx) => (
                <div className="dist-item" key={c.name}>
                  <span className="dist-label">{idx + 1}. {c.name}</span>
                  <span className="dist-value" style={{ color: 'var(--color-info)' }}>{c.count}人次</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
