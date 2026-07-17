import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, expect, it, afterEach } from 'vitest'
import OverviewTab from './OverviewTab'

const mockStudents = [
  { id: 1, age: 40, gender: '男', education: '大學', is_60_plus: '否' },
  { id: 2, age: 55, gender: '女', education: '碩士', is_60_plus: '否' },
  { id: 3, age: 65, gender: '女', education: '高中', is_60_plus: '是' },
  { id: 4, age: null, gender: '女', education: '高中', is_60_plus: '否' }
]

const mockStats = {
  totalStudents: 4,
  totalRegistrations: 5,
  totalRefunds: 0,
  ageGroups: {
    '50歲以下': 1,
    '50-59歲': 1,
    '60-69歲': 1,
    '70-79歲': 0,
    '80歲以上': 0,
    '未知': 1
  },
  eduCounts: { '大專/大學': 1, '研究所': 1, '高中/職': 2 },
  popularCourses: [
    { name: '活力有氧', count: 10 },
    { name: '肌力訓練', count: 5 }
  ]
}

describe('OverviewTab Donut Chart', () => {
  afterEach(cleanup)

  it('renders the donut chart component with total count', () => {
    const { container } = render(<OverviewTab students={mockStudents} stats={mockStats} />)
    
    // Verify total count shows in the center
    expect(container.querySelector('.donut-center-label').textContent).toBe('學員總數')
    expect(container.querySelector('.donut-center-val').textContent).toBe('4人')
  })

  it('displays the 6 age groups in the legend', () => {
    render(<OverviewTab students={mockStudents} stats={mockStats} />)

    expect(screen.getByText('50歲以下')).toBeTruthy()
    expect(screen.getByText('50-59歲')).toBeTruthy()
    expect(screen.getByText('未知')).toBeTruthy()
  })

  it('handles missing stats gracefully and renders empty states', () => {
    // Render with missing stats completely
    const { container, rerender } = render(<OverviewTab students={mockStudents} />)
    expect(container.querySelector('.donut-center-val').textContent).toBe('0人')

    // Render with empty stats object
    rerender(<OverviewTab students={mockStudents} stats={{}} />)
    expect(container.querySelector('.donut-center-val').textContent).toBe('0人')

    // Render with missing ageGroups in stats
    rerender(<OverviewTab students={mockStudents} stats={{ totalStudents: 0, totalRegistrations: 0, totalRefunds: 0, eduCounts: {}, popularCourses: [] }} />)
    expect(container.querySelector('.donut-center-val').textContent).toBe('0人')
  })

  it('updates the center text when hovering over chart slices or legend items', () => {
    const { container } = render(<OverviewTab students={mockStudents} stats={mockStats} />)

    // Initially displays the overall stats
    expect(container.querySelector('.donut-center-label').textContent).toBe('學員總數')
    expect(container.querySelector('.donut-center-val').textContent).toBe('4人')
    expect(container.querySelector('.donut-center-pct').textContent).toBe('年齡層分佈')

    // Hover over the slice for '50歲以下' (using data-testid)
    const slice50 = screen.getByTestId('slice-50歲以下')
    fireEvent.mouseEnter(slice50)

    // Verify center text updates
    expect(container.querySelector('.donut-center-label').textContent).toBe('50歲以下')
    expect(container.querySelector('.donut-center-val').textContent).toBe('1人')
    expect(container.querySelector('.donut-center-pct').textContent).toBe('25.0%')

    // Mouse leave slice
    fireEvent.mouseLeave(slice50)

    // Reverts to overall
    expect(container.querySelector('.donut-center-label').textContent).toBe('學員總數')
    expect(container.querySelector('.donut-center-val').textContent).toBe('4人')

    // Find legend item for '50-59歲'
    const legendItem50_59 = screen.getByText('50-59歲').closest('.donut-legend-item')
    fireEvent.mouseEnter(legendItem50_59)

    // Verify center text updates
    expect(container.querySelector('.donut-center-label').textContent).toBe('50-59歲')
    expect(container.querySelector('.donut-center-val').textContent).toBe('1人')
    expect(container.querySelector('.donut-center-pct').textContent).toBe('25.0%')

    // Mouse leave legend item
    fireEvent.mouseLeave(legendItem50_59)

    // Reverts to overall
    expect(container.querySelector('.donut-center-label').textContent).toBe('學員總數')
    expect(container.querySelector('.donut-center-val').textContent).toBe('4人')
  })

  it('renders the seniors metric indicating 60+ student percentage', () => {
    const { container } = render(<OverviewTab students={mockStudents} stats={mockStats} />)
    
    expect(screen.getByText('樂齡學員佔比 (60歲以上)')).toBeTruthy()
    expect(container.querySelector('.seniors-metric-percentage').textContent).toBe('25.0%')
    expect(screen.getByText('(1人 / 全體4人)')).toBeTruthy()
  })

  it('renders the education distribution list sorted by educational attainment hierarchy', () => {
    const { container } = render(<OverviewTab students={mockStudents} stats={mockStats} />)
    
    const distLabels = Array.from(container.querySelectorAll('.dist-label')).map(el => el.textContent)
    
    expect(distLabels).toEqual(['研究所', '大專/大學', '高中/職'])
  })

  it('updates the courses pie chart active state on sector/legend hover', () => {
    render(<OverviewTab students={mockStudents} stats={mockStats} />)
    
    const legendItem = screen.getByText('活力有氧').closest('.donut-legend-item')
    expect(legendItem.className).not.toContain('active')

    // Hover legend item
    fireEvent.mouseEnter(legendItem)
    expect(legendItem.className).toContain('active')

    // Leave
    fireEvent.mouseLeave(legendItem)
    expect(legendItem.className).not.toContain('active')
  })
})
