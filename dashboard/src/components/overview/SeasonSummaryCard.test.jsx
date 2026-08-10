import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import SeasonSummaryCard from './SeasonSummaryCard'

const currentStats = { enrollments: 120, refunds: 4, refundRate: 3.3, uniqueStudents: 95, newStudents: 25, returningStudents: 70, courses: 210, avgCoursesPerStudent: 2.2 }
const previousStats = { enrollments: 100, refunds: 5, refundRate: 5, uniqueStudents: 80, newStudents: 20, returningStudents: 60, courses: 180, avgCoursesPerStudent: 2 }

describe('SeasonSummaryCard', () => {
  it('renders an empty card when no current season is available', () => {
    const { container } = render(<SeasonSummaryCard currentSeason={null} currentSeasonStats={null} previousSeasonStats={null} />)
    expect(container.querySelector('.season-summary-card.empty')).toBeTruthy()
  })

  it('renders six season summary metrics', () => {
    const { container } = render(<SeasonSummaryCard currentSeason="2025 秋季" currentSeasonStats={currentStats} previousSeasonStats={previousStats} />)
    expect(container.querySelectorAll('.season-summary-stat')).toHaveLength(6)
  })

  it('renders deltas only when a previous season is available', () => {
    const { container, rerender } = render(<SeasonSummaryCard currentSeason="2025 秋季" currentSeasonStats={currentStats} previousSeasonStats={previousStats} />)
    expect(container.querySelectorAll('.season-summary-delta').length).toBeGreaterThan(0)
    rerender(<SeasonSummaryCard currentSeason="2025 秋季" currentSeasonStats={currentStats} previousSeasonStats={null} />)
    expect(container.querySelectorAll('.season-summary-delta')).toHaveLength(0)
  })
})
