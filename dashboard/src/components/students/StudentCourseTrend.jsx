import { useMemo } from 'react'
import { buildStudentCourseTrend } from '../../domain/courseTrend'

export default function StudentCourseTrend({ timeline = [] }) {
  const trends = useMemo(() => buildStudentCourseTrend(timeline), [timeline])

  return (
    <section className="student-course-trend" aria-labelledby="student-course-trend-title">
      <h3 className="student-course-trend-title" id="student-course-trend-title">
        學生選課趨勢圖
      </h3>

      {trends.length > 0 ? (
        <div className="student-course-trend-list">
          {trends.map(trend => (
            <article
              className="student-course-trend-item"
              key={trend.courseName}
              aria-label={`${trend.courseName}，${trend.count} 次${trend.seasons.length ? `，季度：${trend.seasons.join('、')}` : ''}`}
            >
              <span className="student-course-trend-name">{trend.courseName}</span>
              <div className="student-course-trend-track" aria-hidden="true">
                <span className="student-course-trend-fill" style={{ width: `${trend.percentage}%` }} />
              </div>
              <span className="student-course-trend-count">{trend.count} 次</span>
              {trend.seasons.length > 0 && (
                <div className="student-course-trend-seasons" aria-label="選課季度">
                  <span className="student-course-trend-seasons-label">季度</span>
                  {trend.seasons.map(season => (
                    <span className="student-course-trend-season" key={season}>{season}</span>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        <p className="student-course-trend-empty">尚無選課趨勢資料</p>
      )}
    </section>
  )
}
