import React from 'react';
import { ClipboardList, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const SeasonSummaryCard = ({ currentSeason, currentSeasonStats, previousSeasonStats }) => {
  if (!currentSeason || !currentSeasonStats) {
    return (
      <div className="panel-card season-summary-card empty">
        <p className="text-muted">撠?砍迤鞈?</p>
      </div>
    );
  }

  const {
    enrollments = 0,
    refundRate = 0,
    uniqueStudents = 0,
    newStudents = 0,
    returningStudents = 0,
    avgCoursesPerStudent = 0,
  } = currentSeasonStats;

  const getRetentionRate = () => {
    if (uniqueStudents === 0) return 0;
    return (returningStudents / uniqueStudents) * 100;
  };

  const retentionRate = getRetentionRate();

  const getRetentionColor = (rate) => {
    if (rate >= 70) return 'var(--color-success)';
    if (rate >= 50) return 'var(--color-warning)';
    return 'var(--color-danger, #ef4444)';
  };

  const getRefundColor = (rate) => {
    if (rate < 3) return 'var(--color-success)';
    if (rate <= 5) return 'var(--color-warning)';
    return 'var(--color-danger, #ef4444)';
  };

  const renderDelta = (current, previous, isRefund = false) => {
    if (previous == null) return null;
    const diff = current - previous;
    if (diff === 0) return <span className="season-summary-delta neutral"><Minus size={14} /> 0</span>;

    let isPositive = diff > 0;
    let isGood = isRefund ? !isPositive : isPositive;

    return (
      <span className={`season-summary-delta ${isGood ? 'good' : 'bad'}`}>
        {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
        {Math.abs(diff).toFixed(isRefund ? 1 : 0)}{isRefund ? '%' : ''}
      </span>
    );
  };

  const renderRetentionDelta = () => {
    if (!previousSeasonStats || previousSeasonStats.uniqueStudents === 0) return null;
    const prevRate = (previousSeasonStats.returningStudents / previousSeasonStats.uniqueStudents) * 100;
    const diff = retentionRate - prevRate;

    if (diff === 0) return <span className="season-summary-delta neutral"><Minus size={14} /> 0%</span>;

    return (
      <span className={`season-summary-delta ${diff > 0 ? 'good' : 'bad'}`}>
        {diff > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
        {Math.abs(diff).toFixed(1)}%
      </span>
    );
  };

  const renderAvgDelta = () => {
     if (!previousSeasonStats) return null;
     const diff = avgCoursesPerStudent - (previousSeasonStats.avgCoursesPerStudent || 0);
     // Use small epsilon for float comparison
     if (Math.abs(diff) < 0.05) return <span className="season-summary-delta neutral"><Minus size={14} /> 0.0</span>;

     return (
      <span className={`season-summary-delta ${diff > 0 ? 'good' : 'bad'}`}>
        {diff > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
        {Math.abs(diff).toFixed(1)}
      </span>
     )
  };

  return (
    <div className="panel-card season-summary-card">
      <div className="season-summary-header">
        <ClipboardList size={20} className="season-summary-icon" />
        <h3 className="season-summary-title">?? ?砍迤璁?嚗currentSeason}</h3>
      </div>

      <div className="season-summary-grid">
        <div className="season-summary-stat">
          <div className="stat-label">?貉玨摮詨</div>
          <div className="stat-value-row">
            <span className="stat-value">{uniqueStudents} <span className="stat-unit">鈭?/span></span>
            {previousSeasonStats && renderDelta(uniqueStudents, previousSeasonStats.uniqueStudents)}
          </div>
        </div>

        <div className="season-summary-stat">
          <div className="stat-label">?啁?鈭箸</div>
          <div className="stat-value-row">
            <span className="stat-value">{newStudents} <span className="stat-unit">鈭?/span></span>
            {previousSeasonStats && renderDelta(newStudents, previousSeasonStats.newStudents)}
          </div>
        </div>

        <div className="season-summary-stat">
          <div className="stat-label">蝥??/div>
          <div className="stat-value-row">
            <span className="stat-value" style={{ color: getRetentionColor(retentionRate) }}>
              {retentionRate.toFixed(1)} <span className="stat-unit">%</span>
            </span>
            {renderRetentionDelta()}
          </div>
        </div>

        <div className="season-summary-stat">
          <div className="stat-label">?貉玨鈭箸活</div>
          <div className="stat-value-row">
            <span className="stat-value">{enrollments} <span className="stat-unit">鈭箸活</span></span>
            {previousSeasonStats && renderDelta(enrollments, previousSeasonStats.enrollments)}
          </div>
        </div>

        <div className="season-summary-stat">
          <div className="stat-label">?鞎餌?</div>
          <div className="stat-value-row">
            <span className="stat-value" style={{ color: getRefundColor(refundRate) }}>
              {refundRate.toFixed(1)} <span className="stat-unit">%</span>
            </span>
            {previousSeasonStats && renderDelta(refundRate, previousSeasonStats.refundRate, true)}
          </div>
        </div>

        <div className="season-summary-stat">
          <div className="stat-label">撟喳?瘥犖?貉玨</div>
          <div className="stat-value-row">
            <span className="stat-value">{avgCoursesPerStudent.toFixed(1)} <span className="stat-unit">?隤?/span></span>
            {renderAvgDelta()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SeasonSummaryCard;
