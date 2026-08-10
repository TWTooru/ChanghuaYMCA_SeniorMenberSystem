import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import KpiCards from './KpiCards'

const stats = { totalStudents: 300, totalRegistrations: 500, totalRefunds: 20 }
const currentSeasonStats = { uniqueStudents: 95, enrollments: 120, refundRate: 2.5, avgCoursesPerStudent: 2.1 }
const previousSeasonStats = { uniqueStudents: 80, enrollments: 100, refundRate: 4, avgCoursesPerStudent: 2 }

describe('KpiCards', () => {
  it('renders four KPI cards', () => {
    const { container } = render(<KpiCards stats={stats} />)
    expect(container.querySelectorAll('.kpi-card')).toHaveLength(4)
  })

  it('renders current-season subtitles and comparison deltas when data is provided', () => {
    const { container } = render(<KpiCards stats={stats} currentSeasonStats={currentSeasonStats} previousSeasonStats={previousSeasonStats} />)
    expect(container.querySelectorAll('.kpi-subtitle')).toHaveLength(4)
    expect(container.querySelectorAll('.kpi-delta').length).toBeGreaterThan(0)
  })

  it('omits seasonal subtitles without current-season data', () => {
    const { container } = render(<KpiCards stats={stats} />)
    expect(container.querySelectorAll('.kpi-subtitle')).toHaveLength(0)
  })
})
