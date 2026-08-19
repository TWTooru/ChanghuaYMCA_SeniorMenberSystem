import { useEffect, useRef } from 'react';

const FOCUSABLE_ELEMENTS_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function useModalA11y(modalRef, onClose, options = {}) {
  const { disableInitialFocus = false } = options;
  const triggerRef = useRef(null);

  useEffect(() => {
    triggerRef.current = document.activeElement;
    
    const modalNode = modalRef.current;
    if (!modalNode) return;

    const focusableElements = Array.from(modalNode.querySelectorAll(FOCUSABLE_ELEMENTS_SELECTOR));
    const firstElement = focusableElements[0];

    if (!disableInitialFocus && firstElement) {
      firstElement.focus();
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (onClose) onClose();
      } else if (e.key === 'Tab') {
        const currentFocusables = Array.from(modalNode.querySelectorAll(FOCUSABLE_ELEMENTS_SELECTOR));
        if (currentFocusables.length === 0) {
          e.preventDefault();
          return;
        }
        
        const first = currentFocusables[0];
        const last = currentFocusables[currentFocusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first || !modalNode.contains(document.activeElement)) {
            e.preventDefault();
            last?.focus();
          }
        } else {
          if (document.activeElement === last || !modalNode.contains(document.activeElement)) {
            e.preventDefault();
            first?.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (triggerRef.current && typeof triggerRef.current.focus === 'function') {
        triggerRef.current.focus();
      }
    };
  }, [modalRef, onClose, disableInitialFocus]);
}
