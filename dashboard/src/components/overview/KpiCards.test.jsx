import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import KpiCards from './KpiCards'

const stats = { totalStudents: 300, totalRegistrations: 500, totalRefunds: 20, totalRevenue: 1500000 }
const currentSeasonStats = { uniqueStudents: 95, enrollments: 120, refundRate: 2.5, avgCoursesPerStudent: 2.1, revenue: 500000 }
const previousSeasonStats = { uniqueStudents: 80, enrollments: 100, refundRate: 4, avgCoursesPerStudent: 2, revenue: 400000 }

afterEach(cleanup)

describe('KpiCards', () => {
  it('renders five KPI cards', () => {
    const { container } = render(<KpiCards stats={stats} />)
    expect(container.querySelectorAll('.kpi-card')).toHaveLength(5)
  })

  it('renders readable Chinese KPI labels', () => {
    render(<KpiCards stats={stats} />)

    expect(screen.getByText('總學員人數')).toBeTruthy()
    expect(screen.getByText('總報名人次')).toBeTruthy()
    expect(screen.getByText('總退費人次')).toBeTruthy()
    expect(screen.getByText('平均每人報課數')).toBeTruthy()
    expect(screen.getByText('總營收')).toBeTruthy()
  })

  it('renders current-season subtitles and comparison deltas when data is provided', () => {
    const { container } = render(<KpiCards stats={stats} currentSeasonStats={currentSeasonStats} previousSeasonStats={previousSeasonStats} />)
    expect(container.querySelectorAll('.kpi-subtitle')).toHaveLength(5)
    expect(container.querySelectorAll('.kpi-delta').length).toBeGreaterThan(0)
  })

  it('omits seasonal subtitles without current-season data', () => {
    const { container } = render(<KpiCards stats={stats} />)
    expect(container.querySelectorAll('.kpi-subtitle')).toHaveLength(0)
  })
})
