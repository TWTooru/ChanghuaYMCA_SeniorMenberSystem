import React from 'react';
import { Users } from 'lucide-react';

/**
 * ?批???”?辣
 *
 * @param {Object} props
 * @param {number} props.males - ?瑟找犖?? * @param {number} props.females - 憟單找犖?? * @param {number} [props.genderUnknown=0] - ?芰?批?犖?? */
export default function GenderDistributionChart({ males, females, genderUnknown = 0 }) {
  const total = males + females + genderUnknown;

  if (total === 0) {
    return (
      <div className="panel-card" style={{ flex: 1 }}>
        <div className="panel-title">
          <Users size={20} />
          ?批??
        </div>
        <div className="gender-dist-empty">?∟???/div>
      </div>
    );
  }

  const malePct = ((males / total) * 100).toFixed(1);
  const femalePct = ((females / total) * 100).toFixed(1);
  const unknownPct = ((genderUnknown / total) * 100).toFixed(1);

  return (
    <div className="panel-card" style={{ flex: 1 }}>
      <div className="panel-title">
        <Users size={20} />
        ?批??
      </div>

      <div className="gender-dist-chart-container">
        <div className="gender-dist-bar">
          <div
            className="gender-dist-segment male"
            style={{ width: `${malePct}%` }}
          ></div>
          <div
            className="gender-dist-segment female"
            style={{ width: `${femalePct}%` }}
          ></div>
          {genderUnknown > 0 && (
            <div
              className="gender-dist-segment unknown"
              style={{ width: `${unknownPct}%` }}
            ></div>
          )}
        </div>

        <div className="gender-dist-legend">
          <div className="gender-dist-legend-item">
            <div className="gender-dist-dot male"></div>
            <span className="gender-dist-label">??/span>
            <span className="gender-dist-value">{males}鈭?({malePct}%)</span>
          </div>
          <div className="gender-dist-legend-item">
            <div className="gender-dist-dot female"></div>
            <span className="gender-dist-label">憟?/span>
            <span className="gender-dist-value">{females}鈭?({femalePct}%)</span>
          </div>
          {genderUnknown > 0 && (
            <div className="gender-dist-legend-item">
              <div className="gender-dist-dot unknown"></div>
              <span className="gender-dist-label">?芰</span>
              <span className="gender-dist-value">{genderUnknown}鈭?({unknownPct}%)</span>
            </div>
          )}
        </div>

        <div className="gender-dist-total">
          蝮質?嚗total} 鈭?        </div>
      </div>
    </div>
  );
}
