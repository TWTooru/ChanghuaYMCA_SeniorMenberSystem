import { useEffect } from 'react'

let activeLockCount = 0
let previousRootOverflow = ''

export default function useBodyScrollLock(isLocked) {
  useEffect(() => {
    if (!isLocked) return undefined

    if (activeLockCount === 0) {
      previousRootOverflow = document.documentElement.style.overflow
      document.documentElement.style.overflow = 'hidden'
    }
    activeLockCount += 1

    return () => {
      activeLockCount -= 1
      if (activeLockCount === 0) {
        document.documentElement.style.overflow = previousRootOverflow
      }
    }
  }, [isLocked])
}
