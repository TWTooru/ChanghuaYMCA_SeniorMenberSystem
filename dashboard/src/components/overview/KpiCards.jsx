import { Users, BookOpen, DollarSign, BarChart3 } from 'lucide-react'

/** 憿舐內 dashboard ?飛????鞎?KPI ????*/
export default function KpiCards({ stats, currentSeasonStats, previousSeasonStats }) {
  const renderDelta = (current, prev, isRate = false, reverseColors = false) => {
    if (current == null || prev == null) return null;
    const diff = current - prev;
    if (diff === 0) return null;

    const absDiff = Math.abs(diff);
    const formattedAbs = isRate ? absDiff.toFixed(1) : absDiff;
    const prefix = diff > 0 ? '?? : '??;

    let isGreen = diff > 0;
    if (reverseColors) isGreen = diff < 0;

    const colorClass = isGreen ? 'kpi-delta-green' : 'kpi-delta-red';

    return <span className={`kpi-delta ${colorClass}`}>({prefix}{formattedAbs})</span>;
  }

  const getRefundRateClass = (rate) => {
    if (rate < 3) return 'kpi-rate-green';
    if (rate <= 5) return 'kpi-rate-amber';
    return 'kpi-rate-red';
  }

  const avgCourses = (stats?.totalStudents > 0) ? (stats.totalRegistrations / stats.totalStudents).toFixed(1) : '0';

  return (
    <div className="kpi-grid">
      <div className="kpi-card">
        <div className="kpi-icon-wrapper purple"><Users size={24} /></div>
        <div>
          <div className="kpi-label">蝝航???摮詨</div>
          <div className="kpi-value-area">
            <span className="kpi-value">{stats?.totalStudents ?? 0}</span>
            <span className="kpi-unit">鈭?/span>
          </div>
          {currentSeasonStats && (
            <div className="kpi-subtitle">
              ?砍迤 {currentSeasonStats.uniqueStudents} 鈭?              {previousSeasonStats && renderDelta(currentSeasonStats.uniqueStudents, previousSeasonStats.uniqueStudents)}
            </div>
          )}
        </div>
      </div>
      <div className="kpi-card">
        <div className="kpi-icon-wrapper emerald"><BookOpen size={24} /></div>
        <div>
          <div className="kpi-label">蝝航??貉玨蝮賭犖甈?/div>
          <div className="kpi-value-area">
            <span className="kpi-value">{stats?.totalRegistrations ?? 0}</span>
            <span className="kpi-unit">鈭箸活</span>
          </div>
          {currentSeasonStats && (
            <div className="kpi-subtitle">
              ?砍迤 {currentSeasonStats.enrollments} 鈭箸活
              {previousSeasonStats && renderDelta(currentSeasonStats.enrollments, previousSeasonStats.enrollments)}
            </div>
          )}
        </div>
      </div>
      <div className="kpi-card">
        <div className="kpi-icon-wrapper amber"><DollarSign size={24} /></div>
        <div>
          <div className="kpi-label">蝝航??鞎餉???/div>
          <div className="kpi-value-area">
            <span className="kpi-value">{stats?.totalRefunds ?? 0}</span>
            <span className="kpi-unit">鈭箸活</span>
          </div>
          {currentSeasonStats && currentSeasonStats.refundRate != null && (
            <div className="kpi-subtitle">
              ?砍迤?鞎餌? <span className={getRefundRateClass(currentSeasonStats.refundRate)}>{currentSeasonStats.refundRate.toFixed(1)}%</span>
              {previousSeasonStats && previousSeasonStats.refundRate != null && renderDelta(currentSeasonStats.refundRate, previousSeasonStats.refundRate, true, true)}
            </div>
          )}
        </div>
      </div>
      <div className="kpi-card">
        <div className="kpi-icon-wrapper cyan"><BarChart3 size={24} /></div>
        <div>
          <div className="kpi-label">撟喳?瘥犖?貉玨</div>
          <div className="kpi-value-area">
            <span className="kpi-value">{avgCourses}</span>
            <span className="kpi-unit">?/鈭?/span>
          </div>
          {currentSeasonStats && currentSeasonStats.avgCoursesPerStudent != null && (
            <div className="kpi-subtitle">
              ?砍迤 {currentSeasonStats.avgCoursesPerStudent.toFixed(1)} ?/鈭?            </div>
          )}
        </div>
      </div>
    </div>
  )
}
