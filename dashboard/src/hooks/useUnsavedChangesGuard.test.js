import { renderHook, act } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import useUnsavedChangesGuard from './useUnsavedChangesGuard'

describe('useUnsavedChangesGuard', () => {
  it('executes action immediately when no unsaved changes', () => {
    const { result } = renderHook(() => useUnsavedChangesGuard())
    let executed = false

    act(() => result.current.requestAction(() => { executed = true }))

    expect(executed).toBe(true)
    expect(result.current.pendingAction).toBeNull()
  })

  it('blocks action and sets pending when there are unsaved changes', () => {
    const { result } = renderHook(() => useUnsavedChangesGuard())
    let executed = false

    act(() => result.current.setHasUnsavedChanges(true))
    act(() => result.current.requestAction(() => { executed = true }))

    expect(executed).toBe(false)
    expect(result.current.pendingAction).not.toBeNull()
  })

  it('executes pending action on confirm', () => {
    const { result } = renderHook(() => useUnsavedChangesGuard())
    let executed = false

    act(() => result.current.setHasUnsavedChanges(true))
    act(() => result.current.requestAction(() => { executed = true }))
    act(() => result.current.confirmPendingAction())

    expect(executed).toBe(true)
    expect(result.current.pendingAction).toBeNull()
    expect(result.current.hasUnsavedChanges).toBe(false)
  })

  it('clears pending action on cancel', () => {
    const { result } = renderHook(() => useUnsavedChangesGuard())

    act(() => result.current.setHasUnsavedChanges(true))
    act(() => result.current.requestAction(() => {}))
    act(() => result.current.cancelPendingAction())

    expect(result.current.pendingAction).toBeNull()
    expect(result.current.hasUnsavedChanges).toBe(true)
  })
})
