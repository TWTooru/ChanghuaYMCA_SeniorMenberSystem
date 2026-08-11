import { compareSeasons, latestSeason } from '../../domain/season'

export default function SeasonTrendChart({ seasonStats = [] }) {
  if (!seasonStats.length) return <div className="season-trend-empty">暫無報名資料</div>

  const orderedSeasonStats = [...seasonStats].sort((a, b) => compareSeasons(a.season, b.season))
  const rawMax = Math.max(...orderedSeasonStats.map(({ enrollments = 0 }) => enrollments), 1)
  const latest = latestSeason(orderedSeasonStats.map(({ season }) => season))

  const width = 640
  const height = 280
  const pad = { top: 35, right: 35, bottom: 60, left: 50 }

  // 計算圓滑的 Y 軸刻度間隔與上限
  const stepCount = 4
  let step = Math.ceil(rawMax / stepCount)
  if (step <= 5) step = 5
  else if (step <= 10) step = 10
  else if (step <= 25) step = 25
  else if (step <= 50) step = 50
  else if (step <= 100) step = 100
  else step = Math.ceil(step / 50) * 50

  const maxScale = step * stepCount
  const innerHeight = height - pad.top - pad.bottom
  const innerWidth = width - pad.left - pad.right
  const axisY = height - pad.bottom

  // Y 軸輔助線與刻度標籤數據
  const yTicks = []
  for (let i = 0; i <= stepCount; i++) {
    const val = step * i
    const yPos = pad.top + (1 - val / maxScale) * innerHeight
    yTicks.push({ val, yPos })
  }

  // 數據座標繪製點
  const points = orderedSeasonStats.map((item, index) => {
    const enrollments = item.enrollments || 0
    const x = pad.left + (index * innerWidth) / Math.max(orderedSeasonStats.length - 1, 1)
    const y = pad.top + (1 - enrollments / maxScale) * innerHeight
    return { ...item, enrollments, x, y }
  })

  return (
    <div className="season-trend-chart">
      {/* 頂部資訊列：單位與圖例 */}
      <div className="season-trend-header">
        <span className="season-trend-unit">單位：人次</span>
        <div className="season-trend-legend">
          <span className="legend-item">
            <span className="legend-dot historical"></span>歷史期別
          </span>
          <span className="legend-item">
            <span className="legend-dot latest"></span>最新期別
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="各季報名趨勢折線圖">
        {/* 背景 Y 軸輔助網格線與數字刻度 */}
        <g className="season-trend-gridlines">
          {yTicks.map(({ val, yPos }) => (
            <g key={val}>
              <line
                className="season-trend-gridline"
                x1={pad.left}
                y1={yPos}
                x2={width - pad.right}
                y2={yPos}
              />
              <text
                className="season-trend-y-tick"
                x={pad.left - 8}
                y={yPos + 4}
                textAnchor="end"
              >
                {val}
              </text>
            </g>
          ))}
        </g>

        {/* X 與 Y 主座標軸 */}
        <path className="season-trend-axis" d={`M ${pad.left} ${axisY} H ${width - pad.right}`} />
        <path className="season-trend-axis" d={`M ${pad.left} ${pad.top} V ${axisY}`} />

        {/* 趨勢折線 */}
        <polyline
          className="season-trend-line"
          points={points.map(({ x, y }) => `${x},${y}`).join(' ')}
          fill="none"
        />

        {/* 數據點與標籤 */}
        <g>
          {points.map(({ season, enrollments, refunds = 0, x, y }) => (
            <g key={season}>
              <circle
                className={`season-trend-point ${season === latest ? 'season-trend-latest' : ''}`}
                cx={x}
                cy={y}
                r="5"
              >
                <title>{`${season}：${enrollments} 人次，退費 ${refunds} 人次`}</title>
              </circle>
              <text className="season-trend-value" x={x} y={y - 10}>
                {enrollments}
              </text>
              <text
                className="season-trend-label"
                x={x}
                y={axisY + 16}
                transform={`rotate(-35 ${x} ${axisY + 16})`}
                textAnchor="end"
              >
                {season}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  )
}

