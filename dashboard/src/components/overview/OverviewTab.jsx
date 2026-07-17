import { useState } from 'react'
import {
  Users, BookOpen, DollarSign,
  TrendingUp, Award, FileText, Heart
} from 'lucide-react'

const EDUCATION_ORDER = [
  '研究所',
  '大專/大學',
  '高中/職',
  '國中',
  '國小',
  '未受正規教育但識字',
  '不識字',
  '未填寫',
  '未知'
]

export default function OverviewTab({ students, stats = {} }) {
  const [hoveredGroup, setHoveredGroup] = useState(null)
  const [hoveredCourse, setHoveredCourse] = useState(null)

  const colors = [
    { group: '50歲以下', color: '#6366f1', gradient: 'url(#gradient-indigo)' },
    { group: '50-59歲', color: '#3b82f6', gradient: 'url(#gradient-blue)' },
    { group: '60-69歲', color: '#10b981', gradient: 'url(#gradient-emerald)' },
    { group: '70-79歲', color: '#eab308', gradient: 'url(#gradient-amber)' },
    { group: '80歲以上', color: '#f97316', gradient: 'url(#gradient-orange)' },
    { group: '未知', color: '#6b7280', gradient: 'url(#gradient-gray)' },
  ]

  const total = Object.values(stats?.ageGroups || {}).reduce((sum, v) => sum + v, 0)
  const radius = 25
  const circumference = 2 * Math.PI * radius // ~157.08

  let accumulatedCount = 0
  const slices = colors.map(item => {
    const count = (stats?.ageGroups || {})[item.group] || 0
    const percentage = total > 0 ? count / total : 0
    const length = percentage * 238.76
    const offset = total > 0 ? -(accumulatedCount / total) * 238.76 : 0
    accumulatedCount += count
    return {
      ...item,
      count,
      percentage,
      length,
      offset,
    }
  })

  // Active details for central text
  const displayLabel = hoveredGroup ? hoveredGroup : '學員總數'
  const displayCount = hoveredGroup ? ((stats?.ageGroups || {})[hoveredGroup] || 0) : total
  const displayPct = hoveredGroup
    ? `${(total > 0 ? (((stats?.ageGroups || {})[hoveredGroup] || 0) / total) * 100 : 0).toFixed(1)}%`
    : '年齡層分佈'

  const seniorsCount = (students || []).filter(s => s.age >= 60 || s.is_60_plus === '是').length
  const seniorsPercentage = (students || []).length > 0 ? (seniorsCount / students.length) * 100 : 0

  const popularCourses = stats?.popularCourses || []
  const courseTotal = popularCourses.reduce((acc, c) => acc + c.count, 0)
  
  let accumulatedCourseCount = 0
  const courseSlices = popularCourses.map((item, idx) => {
    const colorObj = colors[idx] || colors[colors.length - 1]
    const count = item.count
    const percentage = courseTotal > 0 ? count / courseTotal : 0
    const length = percentage * 157.08
    const offset = courseTotal > 0 ? -(accumulatedCourseCount / courseTotal) * 157.08 : 0

    // Calculate middle angle for label positioning
    const startPct = accumulatedCourseCount / courseTotal
    const endPct = (accumulatedCourseCount + count) / courseTotal
    const midPct = (startPct + endPct) / 2
    const midAngleRad = (midPct * 360 - 90) * Math.PI / 180
    const rLabel = 28 // Radial distance for solid pie labels
    const labelX = 50 + rLabel * Math.cos(midAngleRad)
    const labelY = 50 + rLabel * Math.sin(midAngleRad)

    accumulatedCourseCount += count
    return {
      name: item.name,
      color: colorObj.color,
      gradient: colorObj.gradient,
      count,
      percentage,
      length,
      offset,
      labelX,
      labelY
    }
  })

  // Course active details (removed for solid pie chart)

  return (
    <div>
      {/* KPI Section */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon-wrapper purple"><Users size={24} /></div>
          <div>
            <div className="kpi-label">累計服務學員</div>
            <div className="kpi-value-area">
              <span className="kpi-value">{stats?.totalStudents ?? 0}</span>
              <span className="kpi-unit">人</span>
            </div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon-wrapper emerald"><BookOpen size={24} /></div>
          <div>
            <div className="kpi-label">累計選課總人次</div>
            <div className="kpi-value-area">
              <span className="kpi-value">{stats?.totalRegistrations ?? 0}</span>
              <span className="kpi-unit">人次</span>
            </div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon-wrapper amber"><DollarSign size={24} /></div>
          <div>
            <div className="kpi-label">累計退費記錄</div>
            <div className="kpi-value-area">
              <span className="kpi-value">{stats?.totalRefunds ?? 0}</span>
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
            學員年齡層分佈 (統計人數：{total}人)
          </h3>
          
          <div className="donut-chart-layout">
            <div className="donut-chart-visual">
              <svg viewBox="0 0 100 100" className="donut-svg">
                <defs>
                  <linearGradient id="gradient-indigo" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#818cf8" />
                  </linearGradient>
                  <linearGradient id="gradient-blue" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#60a5fa" />
                  </linearGradient>
                  <linearGradient id="gradient-emerald" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#34d399" />
                  </linearGradient>
                  <linearGradient id="gradient-amber" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#eab308" />
                    <stop offset="100%" stopColor="#fde047" />
                  </linearGradient>
                  <linearGradient id="gradient-orange" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f97316" />
                    <stop offset="100%" stopColor="#fb923c" />
                  </linearGradient>
                  <linearGradient id="gradient-gray" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#6b7280" />
                    <stop offset="100%" stopColor="#9ca3af" />
                  </linearGradient>
                </defs>
                
                {/* Empty state background ring */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="rgba(255, 255, 255, 0.05)"
                  strokeWidth="8"
                />

                {slices.map((slice) => (
                  <circle
                    key={slice.group}
                    data-testid={`slice-${slice.group}`}
                    cx="50"
                    cy="50"
                    r="38"
                    fill="transparent"
                    stroke={slice.gradient}
                    strokeWidth={hoveredGroup === slice.group ? 12 : 8}
                    strokeDasharray={`${slice.length} 238.76`}
                    strokeDashoffset={slice.offset}
                    transform="rotate(-90 50 50)"
                    className={`donut-slice ${hoveredGroup && hoveredGroup !== slice.group ? 'inactive' : ''}`}
                    onMouseEnter={() => setHoveredGroup(slice.group)}
                    onMouseLeave={() => setHoveredGroup(null)}
                  />
                ))}
              </svg>

              <div className="donut-center-text">
                <div className="donut-center-label">{displayLabel}</div>
                <div className="donut-center-val">{displayCount}人</div>
                <div className="donut-center-pct">{displayPct}</div>
              </div>
            </div>

            <div className="donut-legend-list">
              {slices.map((slice) => (
                <div
                  key={slice.group}
                  className={`donut-legend-item ${hoveredGroup === slice.group ? 'active' : ''}`}
                  onMouseEnter={() => setHoveredGroup(slice.group)}
                  onMouseLeave={() => setHoveredGroup(null)}
                >
                  <div className="donut-legend-left">
                    <span className="donut-legend-dot" style={{ backgroundColor: slice.color }}></span>
                    <span className="donut-legend-label">{slice.group}</span>
                  </div>
                  <div className="donut-legend-right">
                    <span className="donut-legend-pct">{(slice.percentage * 100).toFixed(0)}%</span>
                    <span className="donut-legend-val">{slice.count}人</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="seniors-metric-divider"></div>
          <h3 className="panel-title">
            <FileText size={18} className="header-icon" />
            最熱門課程項目 (前 {popularCourses.length} 名)
          </h3>
          
          <div className="donut-chart-layout">
            <div className="donut-chart-visual">
              <svg viewBox="0 0 100 100" className="donut-svg">
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="transparent"
                  stroke="rgba(255, 255, 255, 0.05)"
                  strokeWidth="50"
                />
                
                {courseTotal > 0 && courseSlices.map(slice => {
                  const isHovered = hoveredCourse === slice.name
                  const hasActiveSelection = hoveredCourse !== null
                  const opacity = hasActiveSelection ? (isHovered ? 1 : 0.3) : 1
                  const strokeWidth = isHovered ? 52 : 50
                  
                  return (
                    <circle
                      key={slice.name}
                      cx="50"
                      cy="50"
                      r={radius}
                      fill="transparent"
                      stroke={slice.gradient}
                      strokeWidth={strokeWidth}
                      strokeDasharray={`${slice.length} ${circumference}`}
                      strokeDashoffset={slice.offset}
                      transform="rotate(-90 50 50)"
                      className="donut-slice"
                      style={{
                        opacity,
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={() => setHoveredCourse(slice.name)}
                      onMouseLeave={() => setHoveredCourse(null)}
                      data-testid={`course-slice-${slice.name}`}
                    />
                  )
                })}

                {/* Pie Chart Percentage Labels */}
                {courseTotal > 0 && courseSlices.map(slice => {
                  if (slice.percentage <= 0.05) return null // Skip tiny slices
                  return (
                    <text
                      key={`label-${slice.name}`}
                      x={slice.labelX}
                      y={slice.labelY + 2} // vertical centering adjustment
                      fill="#ffffff"
                      fontSize="5.5"
                      fontWeight="bold"
                      textAnchor="middle"
                      pointerEvents="none"
                      style={{
                        opacity: hoveredCourse && hoveredCourse !== slice.name ? 0.4 : 1,
                        transition: 'opacity 0.25s ease',
                        textShadow: '0 1px 2px rgba(0,0,0,0.6)'
                      }}
                    >
                      {(slice.percentage * 100).toFixed(0)}%
                    </text>
                  )
                })}
              </svg>
            </div>
            
            <div className="donut-legend-list">
              {courseSlices.map(slice => (
                <div
                  key={slice.name}
                  className={`donut-legend-item ${hoveredCourse === slice.name ? 'active' : ''}`}
                  onMouseEnter={() => setHoveredCourse(slice.name)}
                  onMouseLeave={() => setHoveredCourse(null)}
                >
                  <div className="donut-legend-left">
                    <span className="donut-legend-dot" style={{ backgroundColor: slice.color }}></span>
                    <span className="donut-legend-label">{slice.name}</span>
                  </div>
                  <div className="donut-legend-right">
                    <span className="donut-legend-pct">{(slice.percentage * 100).toFixed(0)}%</span>
                    <span className="donut-legend-val">{slice.count}人次</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="panel-card" style={{ flex: 1 }}>
            <h3 className="panel-title">
              <Award size={18} className="header-icon" />
              教育程度分佈
            </h3>
            <div className="distribution-list">
              {Object.entries(stats?.eduCounts || {})
                .sort((a, b) => {
                  const idxA = EDUCATION_ORDER.indexOf(a[0])
                  const idxB = EDUCATION_ORDER.indexOf(b[0])
                  const orderA = idxA === -1 ? 999 : idxA
                  const orderB = idxB === -1 ? 999 : idxB
                  return orderA - orderB
                })
                .map(([edu, count]) => {
                  const pct = (stats?.totalStudents || 0) > 0 ? (count / stats.totalStudents) * 100 : 0
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
              <Heart size={18} className="header-icon" style={{ color: 'var(--color-success)' }} />
              樂齡學員佔比 (60歲以上)
            </h3>
            
            <div className="seniors-metric-header" style={{ marginTop: '16px' }}>
              <div className="seniors-metric-value-group">
                <span className="seniors-metric-percentage" style={{ fontSize: '24px' }}>{seniorsPercentage.toFixed(1)}%</span>
                <span className="seniors-metric-count">({seniorsCount}人 / 全體{students ? students.length : 0}人)</span>
              </div>
            </div>
            <div className="seniors-progress-track" style={{ marginTop: '12px' }}>
              <div className="seniors-progress-fill" style={{ width: `${seniorsPercentage}%` }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
