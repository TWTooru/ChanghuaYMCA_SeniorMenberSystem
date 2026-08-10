import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import SeasonTrendChart from './SeasonTrendChart'

describe('SeasonTrendChart', () => {
  it('renders an empty state with no season data', () => {
    const { container } = render(<SeasonTrendChart seasonStats={[]} />)
    expect(container.querySelector('.season-trend-empty')).toBeTruthy()
  })

  it('renders every season and highlights the latest one', () => {
    const { container } = render(<SeasonTrendChart seasonStats={[{ season: '第十五季', enrollments: 100, refunds: 5 }, { season: '第十六季', enrollments: 120, refunds: 3 }]} />)
    expect(container.querySelectorAll('.season-trend-row')).toHaveLength(2)
    expect(container.querySelectorAll('.season-trend-latest')).toHaveLength(1)
  })

  it('only renders a refund label for seasons with refunds', () => {
    const { container } = render(<SeasonTrendChart seasonStats={[{ season: '第十五季', enrollments: 100, refunds: 0 }, { season: '第十六季', enrollments: 120, refunds: 3 }]} />)
    expect(container.querySelectorAll('.season-trend-refund-text')).toHaveLength(1)
  })
})
