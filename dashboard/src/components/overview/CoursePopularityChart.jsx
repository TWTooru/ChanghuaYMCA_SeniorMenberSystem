import { useState } from 'react'
import { Award, FileText, Heart } from 'lucide-react'

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

export default function CoursePopularityChart({
  popularCourses = [],
  eduCounts = {},
  totalStudents = 0,
  students = []
}) {
  const [hoveredCourse, setHoveredCourse] = useState(null)

  const colors = [
    { group: '50歲以下', color: '#6366f1', gradient: 'url(#gradient-indigo)' },
    { group: '50-59歲', color: '#3b82f6', gradient: 'url(#gradient-blue)' },
    { group: '60-69歲', color: '#10b981', gradient: 'url(#gradient-emerald)' },
    { group: '70-79歲', color: '#eab308', gradient: 'url(#gradient-amber)' },
    { group: '80歲以上', color: '#f97316', gradient: 'url(#gradient-orange)' },
    { group: '未知', color: '#6b7280', gradient: 'url(#gradient-gray)' },
  ]

  const radius = 25
  const circumference = 2 * Math.PI * radius // ~157.08

  const courseList = popularCourses || []
  const courseTotal = courseList.reduce((acc, c) => acc + c.count, 0)
  
  let accumulatedCourseCount = 0
  const courseSlices = courseList.map((item, idx) => {
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

  const seniorsCount = (students || []).filter(s => s.age >= 60 || s.is_60_plus === '是').length
  const seniorsPercentage = (students || []).length > 0 ? (seniorsCount / students.length) * 100 : 0

  return (
    <>
      <div className="panel-card">
        <h3 className="panel-title">
          <FileText size={18} className="header-icon" />
          最熱門課程項目 (前 {courseList.length} 名)
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
            {Object.entries(eduCounts || {})
              .sort((a, b) => {
                const idxA = EDUCATION_ORDER.indexOf(a[0])
                const idxB = EDUCATION_ORDER.indexOf(b[0])
                const orderA = idxA === -1 ? 999 : idxA
                const orderB = idxB === -1 ? 999 : idxB
                return orderA - orderB
              })
              .map(([edu, count]) => {
                const pct = (totalStudents || 0) > 0 ? (count / totalStudents) * 100 : 0
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
    </>
  )
}
