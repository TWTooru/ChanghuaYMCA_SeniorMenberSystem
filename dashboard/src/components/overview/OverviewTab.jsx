import './OverviewTab.css'
import KpiCards from './KpiCards'
import SeasonSummaryCard from './SeasonSummaryCard'
import SeasonTrendChart from './SeasonTrendChart'
import AgeDistributionChart from './AgeDistributionChart'
import CoursePopularityChart from './CoursePopularityChart'
import EducationDistributionChart from './EducationDistributionChart'
import SeniorsMetricCard from './SeniorsMetricCard'
import GenderDistributionChart from './GenderDistributionChart'
import CollapsiblePanel from './CollapsiblePanel'

export default function OverviewTab({ students = [], stats = {} }) {
  return <div>
    <CollapsiblePanel title={`當季概覽：${stats.currentSeason || '尚未設定季別'}`} className="season-summary-card"><SeasonSummaryCard currentSeason={stats.currentSeason} currentSeasonStats={stats.currentSeasonStats} /></CollapsiblePanel>
    <CollapsiblePanel title="整體 KPI" className="kpi-panel"><KpiCards stats={stats} currentSeasonStats={stats.currentSeasonStats} previousSeasonStats={stats.previousSeasonStats} /></CollapsiblePanel>
    <div className="overview-grid">
      <div className="overview-column">
        <CollapsiblePanel title="各季報名趨勢"><SeasonTrendChart seasonStats={stats.seasonStats} /></CollapsiblePanel>
        <CollapsiblePanel title="學員年齡層分佈"><AgeDistributionChart ageGroups={stats.ageGroups} /></CollapsiblePanel>
        <CollapsiblePanel title="最熱門課程項目"><CoursePopularityChart popularCourses={stats.popularCourses} /></CollapsiblePanel>
      </div>
      <div className="overview-column">
        <CollapsiblePanel title="教育程度分佈" className="education-insights-card">
          <EducationDistributionChart eduCounts={stats.eduCounts} totalStudents={stats.totalStudents} embedded />
          <SeniorsMetricCard students={students} embedded />
          <GenderDistributionChart males={stats.males ?? 0} females={stats.females ?? 0} genderUnknown={stats.genderUnknown ?? 0} embedded />
        </CollapsiblePanel>
      </div>
    </div>
  </div>
}
