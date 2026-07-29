import { useState } from 'react'
import { FileText } from 'lucide-react'

/**
 * 依報名人次排序的熱門課程資料繪製 donut；切片與圖例共享同一個 hover course。
 */
export default function CoursePopularityChart({ popularCourses = [] }) {
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
  const circumference = 2 * Math.PI * radius

  const courseList = popularCourses || []
  const courseTotal = courseList.reduce((acc, c) => acc + c.count, 0)
  
  let accumulatedCourseCount = 0
  const courseSlices = courseList.map((item, idx) => {
    const colorObj = colors[idx] || colors[colors.length - 1]
    const count = item.count
    const percentage = courseTotal > 0 ? count / courseTotal : 0
    const length = percentage * 157.08
    const offset = courseTotal > 0 ? -(accumulatedCourseCount / courseTotal) * 157.08 : 0

    // 百分比標籤依扇形中點定位，避免與相鄰扇形重疊。
    const startPct = accumulatedCourseCount / courseTotal
    const endPct = (accumulatedCourseCount + count) / courseTotal
    const midPct = (startPct + endPct) / 2
    const midAngleRad = (midPct * 360 - 90) * Math.PI / 180
    const rLabel = 28
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

  return (
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

            {courseTotal > 0 && courseSlices.map(slice => {
              if (slice.percentage <= 0.05) return null
              return (
                <text
                  key={`label-${slice.name}`}
                  x={slice.labelX}
                  y={slice.labelY + 2}
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
  )
}
