import { BarChart3 } from 'lucide-react'
import { compareSeasons, latestSeason } from '../../domain/season'

export default function SeasonTrendChart({ seasonStats = [] }) {
  if (!seasonStats.length) return <div className="season-trend-empty">暫無報名資料</div>
  const orderedSeasonStats = [...seasonStats].sort((a, b) => compareSeasons(a.season, b.season))
  const max = Math.max(...orderedSeasonStats.map(({ enrollments = 0 }) => enrollments), 1)
  const latest = latestSeason(orderedSeasonStats.map(({ season }) => season))
  const width = 600; const height = 240; const pad = { top: 34, right: 34, bottom: 54, left: 34 }
  const points = orderedSeasonStats.map((item, index) => ({ ...item, x: pad.left + (index * (width - pad.left - pad.right)) / Math.max(orderedSeasonStats.length - 1, 1), y: height - pad.bottom - ((item.enrollments || 0) / max) * (height - pad.top - pad.bottom) }))
  return <div className="season-trend-chart"><div className="season-trend-chart-legend"><BarChart3 size={18} /> 報名人次</div><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="各季報名趨勢折線圖"><path className="season-trend-axis" d={`M ${pad.left} ${height - pad.bottom} H ${width - pad.right}`} /><polyline className="season-trend-line" points={points.map(({ x, y }) => `${x},${y}`).join(' ')} fill="none" /><g>{points.map(({ season, enrollments = 0, refunds = 0, x, y }) => <g key={season}><circle className={`season-trend-point ${season === latest ? 'season-trend-latest' : ''}`} cx={x} cy={y} r="5"><title>{`${season}：${enrollments} 人次，退費 ${refunds} 人次`}</title></circle><text className="season-trend-value" x={x} y={y - 10}>{enrollments}</text><text className="season-trend-label" x={x} y={height - pad.bottom + 16} transform={`rotate(-40 ${x} ${height - pad.bottom + 16})`} textAnchor="end">{season}</text></g>)}</g></svg></div>
}
