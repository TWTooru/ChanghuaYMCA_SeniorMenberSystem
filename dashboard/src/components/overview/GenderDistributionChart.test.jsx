import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import GenderDistributionChart from './GenderDistributionChart'

describe('GenderDistributionChart', () => {
  it('renders only male and female counts', () => {
    render(<GenderDistributionChart genderCounts={[{ label: '男', value: 2 }, { label: '女', value: 3 }]} />)
    expect(screen.getByText('男：2')).not.toBeNull()
    expect(screen.getByText('女：3')).not.toBeNull()
    expect(screen.queryByText(/未知/)).toBeNull()
  })
})
