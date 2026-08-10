import React from 'react';
import { BarChart3 } from 'lucide-react';
import { latestSeason } from '../../domain/season';

const SeasonTrendChart = ({ seasonStats = [] }) => {
  if (!seasonStats || seasonStats.length === 0) {
    return (
      <div className="panel-card season-trend-card">
        <h2 className="panel-title">
          <BarChart3 size={20} />
          ?迤?貉玨頞典
        </h2>
        <div className="season-trend-empty">
          ?怎?貉玨?豢?
        </div>
      </div>
    );
  }

  const maxEnrollments = Math.max(...seasonStats.map(s => s.enrollments || 0), 1);
  const latest = latestSeason(seasonStats.map(s => s.season));

  return (
    <div className="panel-card season-trend-card">
      <h2 className="panel-title">
        <BarChart3 size={20} />
        ?迤?貉玨頞典
      </h2>
      <div className="season-trend-list">
        {seasonStats.map(stat => {
          const { season, enrollments = 0, refunds = 0 } = stat;
          const net = enrollments - refunds;
          const isLatest = season === latest;

          // Width calculations relative to max enrollments
          const netWidth = `${(net / maxEnrollments) * 100}%`;
          const refundWidth = `${(refunds / maxEnrollments) * 100}%`;

          return (
            <div
              key={season}
              className={`season-trend-row ${isLatest ? 'season-trend-latest' : ''}`}
            >
              <div className="season-trend-label">{season}</div>
              <div className="season-trend-bar-container">
                <div className="season-trend-bars">
                  {net > 0 && (
                    <div
                      className="season-trend-bar-net"
                      style={{ width: netWidth }}
                      title={`瘛典?? ${net}`}
                    />
                  )}
                  {refunds > 0 && (
                    <div
                      className="season-trend-bar-refund"
                      style={{ width: refundWidth }}
                      title={`?鞎? ${refunds}`}
                    />
                  )}
                </div>
              </div>
              <div className="season-trend-numbers">
                <span className="season-trend-net-text">{net}鈭箸活</span>
                {refunds > 0 && (
                  <span className="season-trend-refund-text">(?{refunds})</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SeasonTrendChart;
