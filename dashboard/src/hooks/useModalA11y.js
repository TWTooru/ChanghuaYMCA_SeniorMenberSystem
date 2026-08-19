import { useEffect, useRef } from 'react'

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * 為 Modal 提供：(1) 開啟時 focus 至首個可聚焦元素 (2) Tab 鍵 focus trap
 * (3) Escape 鍵關閉 (4) 關閉後 focus 返回觸發元素。
 */
export default function useModalA11y(modalRef, onClose) {
  const triggerRef = useRef(null)

  useEffect(() => {
    triggerRef.current = document.activeElement

    const modal = modalRef.current
    if (!modal) return

    const firstFocusable = modal.querySelector(FOCUSABLE)
    firstFocusable?.focus()

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose?.()
        return
      }
      if (e.key === 'Tab') {
        const focusableEls = modal.querySelectorAll(FOCUSABLE)
        if (focusableEls.length === 0) return
        const first = focusableEls[0]
        const last = focusableEls[focusableEls.length - 1]
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus() }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus() }
        }
      }
    }

    modal.addEventListener('keydown', handleKeyDown)
    return () => {
      modal.removeEventListener('keydown', handleKeyDown)
      triggerRef.current?.focus()
    }
  }, [modalRef, onClose])
}
