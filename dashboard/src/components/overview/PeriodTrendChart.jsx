import React from 'react';

export default function PeriodTrendChart({ periodStats = [] }) {
  if (!periodStats || periodStats.length === 0) {
    return <p style={{ color: 'var(--text-muted)' }}>尚無歷期資料</p>;
  }

  const maxEnrollments = Math.max(...periodStats.map(p => p.enrollments), 1);

  return (
    <div className="period-trend-chart">
      {periodStats.map(p => {
        const percentage = (p.enrollments / maxEnrollments) * 100;
        return (
          <div key={p.period} className="trend-bar-row">
            <div className="trend-label">{p.period}</div>
            <div className="trend-bar-track">
              <div 
                className="trend-bar-fill" 
                style={{ width: `${percentage}%` }}
              ></div>
            </div>
            <div className="trend-value">{p.enrollments} 人次</div>
          </div>
        );
      })}
    </div>
  );
}
