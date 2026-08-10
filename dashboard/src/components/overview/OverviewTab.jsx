import './OverviewTab.css'
import KpiCards from './KpiCards'
import SeasonSummaryCard from './SeasonSummaryCard'
import SeasonTrendChart from './SeasonTrendChart'
import AgeDistributionChart from './AgeDistributionChart'
import CoursePopularityChart from './CoursePopularityChart'
import EducationDistributionChart from './EducationDistributionChart'
import SeniorsMetricCard from './SeniorsMetricCard'
import GenderDistributionChart from './GenderDistributionChart'

/**
 * 整合上層 useStats 產生的 KPI 與統計分布，讓各卡片共用同一份學生快照資料。
 */
export default function OverviewTab({ students, stats = {} }) {
  return (
    <div>
      <SeasonSummaryCard
        currentSeason={stats?.currentSeason}
        currentSeasonStats={stats?.currentSeasonStats}
        previousSeasonStats={stats?.previousSeasonStats}
      />
      <KpiCards
        stats={stats}
        currentSeasonStats={stats?.currentSeasonStats}
        previousSeasonStats={stats?.previousSeasonStats}
      />
      <div className="overview-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <SeasonTrendChart seasonStats={stats?.seasonStats} />
          <AgeDistributionChart ageGroups={stats?.ageGroups} />
          <CoursePopularityChart popularCourses={stats?.popularCourses} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <GenderDistributionChart
            males={stats?.males ?? 0}
            females={stats?.females ?? 0}
            genderUnknown={stats?.genderUnknown ?? 0}
          />
          <EducationDistributionChart eduCounts={stats?.eduCounts} totalStudents={stats?.totalStudents} />
          <SeniorsMetricCard students={students} />
        </div>
      </div>
    </div>
  )
}
