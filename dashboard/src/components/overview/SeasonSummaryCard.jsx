const metrics = (stats) => [
  ['本季學員數', stats.uniqueStudents ?? 0, '人'],
  ['新生人數', stats.newStudents ?? 0, '人'],
  ['續報率', `${stats.uniqueStudents ? ((stats.returningStudents || 0) / stats.uniqueStudents * 100).toFixed(1) : '0.0'}`, '%'],
  ['本季報名人次', stats.enrollments ?? 0, '人次'],
  ['退費率', `${(stats.refundRate ?? 0).toFixed(1)}`, '%'],
  ['平均每人報課數', `${(stats.avgCoursesPerStudent ?? 0).toFixed(1)}`, '堂'],
]

export default function SeasonSummaryCard({ currentSeason, currentSeasonStats, previousSeasonStats }) {
  if (!currentSeason || !currentSeasonStats) return <div className="season-summary-card empty"><p className="text-muted">尚無本季資料</p></div>
  return <div className="season-summary-grid">{metrics(currentSeasonStats).map(([label, value, unit]) => <div className="season-summary-stat" key={label}><div className="stat-label">{label}</div><div className="stat-value-row"><div className="stat-value">{value} <span className="stat-unit">{unit}</span></div>{previousSeasonStats && <span className="season-summary-delta">比較前季</span>}</div></div>)}</div>
}
