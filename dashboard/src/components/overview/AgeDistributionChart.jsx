import { useState } from 'react'
import { TrendingUp } from 'lucide-react'

export default function AgeDistributionChart({ ageGroups }) {
  const [hoveredGroup, setHoveredGroup] = useState(null)

  const colors = [
    { group: '50歲以下', color: '#6366f1', gradient: 'url(#gradient-indigo)' },
    { group: '50-59歲', color: '#3b82f6', gradient: 'url(#gradient-blue)' },
    { group: '60-69歲', color: '#10b981', gradient: 'url(#gradient-emerald)' },
    { group: '70-79歲', color: '#eab308', gradient: 'url(#gradient-amber)' },
    { group: '80歲以上', color: '#f97316', gradient: 'url(#gradient-orange)' },
    { group: '未知', color: '#6b7280', gradient: 'url(#gradient-gray)' },
  ]

  const total = Object.values(ageGroups || {}).reduce((sum, v) => sum + v, 0)

  let accumulatedCount = 0
  const slices = colors.map(item => {
    const count = (ageGroups || {})[item.group] || 0
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
  const displayCount = hoveredGroup ? ((ageGroups || {})[hoveredGroup] || 0) : total
  const displayPct = hoveredGroup
    ? `${(total > 0 ? (((ageGroups || {})[hoveredGroup] || 0) / total) * 100 : 0).toFixed(1)}%`
    : '年齡層分佈'

  return (
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
    </div>
  )
}
