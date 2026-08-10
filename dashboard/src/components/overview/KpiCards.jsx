import { Users, BookOpen, DollarSign, BarChart3 } from 'lucide-react'

export default function KpiCards({ stats = {}, currentSeasonStats, previousSeasonStats }) {
  const delta = (current, previous, reverse = false) => {
    if (current == null || previous == null || current === previous) return null
    const difference = current - previous
    return <span className={`kpi-delta ${(reverse ? difference < 0 : difference > 0) ? 'kpi-delta-green' : 'kpi-delta-red'}`}>({difference > 0 ? '↑' : '↓'}{Math.abs(difference)})</span>
  }
  const average = stats.totalStudents > 0 ? (stats.totalRegistrations / stats.totalStudents).toFixed(1) : '0'
  const cards = [
    [Users, 'purple', '總學員人數', stats.totalStudents ?? 0, '人', currentSeasonStats && <>當季：{currentSeasonStats.uniqueStudents} 人 {delta(currentSeasonStats.uniqueStudents, previousSeasonStats?.uniqueStudents)}</>],
    [BookOpen, 'emerald', '總報名人次', stats.totalRegistrations ?? 0, '人次', currentSeasonStats && <>當季：{currentSeasonStats.enrollments} 人次 {delta(currentSeasonStats.enrollments, previousSeasonStats?.enrollments)}</>],
    [DollarSign, 'amber', '總退費人次', stats.totalRefunds ?? 0, '人次', currentSeasonStats?.refundRate != null && <>當季退費率：{currentSeasonStats.refundRate.toFixed(1)}% {delta(currentSeasonStats.refundRate, previousSeasonStats?.refundRate, true)}</>],
    [BarChart3, 'cyan', '平均每人報課數', average, '堂／人', currentSeasonStats?.avgCoursesPerStudent != null && <>當季：{currentSeasonStats.avgCoursesPerStudent.toFixed(1)} 堂／人</>],
  ]
  return <div className="kpi-grid">{cards.map(([Icon, color, label, value, unit, subtitle]) => <div className="kpi-card" key={label}><div className={`kpi-icon-wrapper ${color}`}><Icon size={24} /></div><div><div className="kpi-label">{label}</div><div className="kpi-value-area"><span className="kpi-value">{value}</span><span className="kpi-unit">{unit}</span></div>{subtitle && <div className="kpi-subtitle">{subtitle}</div>}</div></div>)}</div>
}
