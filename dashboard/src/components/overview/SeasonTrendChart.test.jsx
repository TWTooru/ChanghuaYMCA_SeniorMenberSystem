import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import SeasonTrendChart from './SeasonTrendChart'

describe('SeasonTrendChart', () => {
  it('renders an empty state with no season data', () => {
    render(<SeasonTrendChart seasonStats={[]} />)
    expect(screen.getByText('暫無報名資料')).toBeTruthy()
  })

  it('renders a line and a point for every season', () => {
    const { container } = render(<SeasonTrendChart seasonStats={[{ season: '第十五季', enrollments: 100, refunds: 5 }, { season: '第十六季', enrollments: 120, refunds: 3 }]} />)
    expect(container.querySelector('.season-trend-line')).toBeTruthy()
    expect(container.querySelectorAll('.season-trend-point')).toHaveLength(2)
    expect(container.querySelectorAll('.season-trend-latest')).toHaveLength(1)
  })
})
