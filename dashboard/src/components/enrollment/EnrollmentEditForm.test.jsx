import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EnrollmentEditForm from './EnrollmentEditForm'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => ({ supabase: { from: vi.fn() } }))

const enrollment = { enrollment_id: 1, season: '第16期', reg_type: '新', refunded: 0, courses: [] }

function installSuccessfulSave() {
  const update = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }))
  supabase.from.mockImplementation(table => {
    if (table === 'enrollments') return { update }
    return {
      select: () => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }),
      delete: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) })
    }
  })
  return update
}

describe('EnrollmentEditForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(window, 'alert').mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('canonicalizes a valid season before updating the enrollment', async () => {
    const update = installSuccessfulSave()
    render(<EnrollmentEditForm enrollment={enrollment} onSave={vi.fn()} onCancel={vi.fn()} />)

    fireEvent.click(screen.getAllByRole('button').at(-1))

    await waitFor(() => expect(update).toHaveBeenCalled())
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ season: '第十六季' }))
  })

  it('rejects an invalid season before calling Supabase', () => {
    render(<EnrollmentEditForm enrollment={enrollment} onSave={vi.fn()} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByDisplayValue('第16期'), { target: { value: '春季班' } })

    fireEvent.click(screen.getAllByRole('button').at(-1))

    expect(supabase.from).not.toHaveBeenCalled()
    expect(window.alert).toHaveBeenCalledWith('請輸入有效的季度，例如：第十六季')
  })
})
