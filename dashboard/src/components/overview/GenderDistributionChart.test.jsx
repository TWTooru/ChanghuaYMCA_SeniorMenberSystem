import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import GenderDistributionChart from './GenderDistributionChart'

describe('GenderDistributionChart', () => {
  it('renders an empty state when every count is zero', () => {
    const { container } = render(<GenderDistributionChart males={0} females={0} genderUnknown={0} />)
    expect(container.querySelector('.gender-dist-empty')).toBeTruthy()
  })

  it('renders male and female segments without an unknown segment by default', () => {
    const { container } = render(<GenderDistributionChart males={30} females={70} />)
    expect(container.querySelector('.gender-dist-segment.male')).toBeTruthy()
    expect(container.querySelector('.gender-dist-segment.female')).toBeTruthy()
    expect(container.querySelector('.gender-dist-segment.unknown')).toBeNull()
  })

  it('renders an unknown segment when the count is nonzero', () => {
    const { container } = render(<GenderDistributionChart males={40} females={50} genderUnknown={10} />)
    expect(container.querySelector('.gender-dist-segment.unknown')).toBeTruthy()
  })
})
