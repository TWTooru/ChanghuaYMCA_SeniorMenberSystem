import { render, screen, fireEvent } from '@testing-library/react';
import { useRef, useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useModalA11y from './useModalA11y';

const TestComponent = ({ onClose, disableInitialFocus = false }) => {
  const modalRef = useRef(null);
  useModalA11y(modalRef, onClose, { disableInitialFocus });

  return (
    <div ref={modalRef} data-testid="modal">
      <button data-testid="btn1">Button 1</button>
      <button data-testid="btn2">Button 2</button>
      <button data-testid="btn3">Button 3</button>
    </div>
  );
};

const App = () => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef(null);

  return (
    <div>
      <button 
        data-testid="trigger" 
        ref={triggerRef} 
        onClick={() => setIsOpen(true)}
      >
        Open Modal
      </button>
      {isOpen && <TestComponent onClose={() => setIsOpen(false)} />}
    </div>
  );
};

describe('useModalA11y', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(<TestComponent onClose={onClose} />);
    
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('traps focus inside the modal on Tab', () => {
    render(<TestComponent onClose={vi.fn()} />);
    
    const btn1 = screen.getByTestId('btn1');
    const btn3 = screen.getByTestId('btn3');
    
    expect(document.activeElement).toBe(btn1);
    
    btn3.focus();
    expect(document.activeElement).toBe(btn3);
    
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: false });
    expect(document.activeElement).toBe(btn1);
  });

  it('traps focus inside the modal on Shift+Tab', () => {
    render(<TestComponent onClose={vi.fn()} />);
    
    const btn1 = screen.getByTestId('btn1');
    const btn3 = screen.getByTestId('btn3');
    
    expect(document.activeElement).toBe(btn1);
    
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(btn3);
  });

  it('restores focus to previous element on unmount', () => {
    render(<App />);
    
    const trigger = screen.getByTestId('trigger');
    trigger.focus();
    expect(document.activeElement).toBe(trigger);
    
    fireEvent.click(trigger);
    const btn1 = screen.getByTestId('btn1');
    expect(document.activeElement).toBe(btn1);
    
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.activeElement).toBe(trigger);
  });
});
