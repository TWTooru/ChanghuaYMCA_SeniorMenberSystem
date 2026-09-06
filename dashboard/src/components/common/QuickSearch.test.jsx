import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import QuickSearch from './QuickSearch';

describe('QuickSearch', () => {
  afterEach(cleanup);
  const students = [
    { student_id: 'A001', name: 'John Doe', phone: '0912345678', email: 'john@example.com' },
    { student_id: 'A002', name: 'Jane Smith', phone: '0987654321', email: 'jane@example.com' },
  ];

  it('filters students by name', () => {
    render(<QuickSearch students={students} onSelect={() => {}} onClose={() => {}} />);
    const input = screen.getByPlaceholderText(/搜尋學號/i);
    fireEvent.change(input, { target: { value: 'john' } });
    
    expect(screen.queryByText('John Doe')).not.toBeNull();
    expect(screen.queryByText('Jane Smith')).toBeNull();
  });

  it('clicking a result calls onSelect and onClose', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(<QuickSearch students={students} onSelect={onSelect} onClose={onClose} />);
    
    const input = screen.getByPlaceholderText(/搜尋學號/i);
    fireEvent.change(input, { target: { value: 'jane' } });
    
    const item = screen.getByText('Jane Smith');
    fireEvent.click(item);
    
    expect(onSelect).toHaveBeenCalledWith(students[1]);
    expect(onClose).toHaveBeenCalled();
  });

  it('keyboard navigation works', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(<QuickSearch students={students} onSelect={onSelect} onClose={onClose} />);
    
    const input = screen.getByPlaceholderText(/搜尋學號/i);
    fireEvent.change(input, { target: { value: 'j' } });
    
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    
    expect(onSelect).toHaveBeenCalledWith(students[1]);
    expect(onClose).toHaveBeenCalled();
  });

  it('pressing Escape calls onClose', () => {
    const onClose = vi.fn();
    render(<QuickSearch students={students} onSelect={() => {}} onClose={onClose} />);
    
    const input = screen.getByPlaceholderText(/搜尋學號/i);
    fireEvent.keyDown(input, { key: 'Escape' });
    
    expect(onClose).toHaveBeenCalled();
  });
  
  it('shows no results message', () => {
    render(<QuickSearch students={students} onSelect={() => {}} onClose={() => {}} />);
    const input = screen.getByPlaceholderText(/搜尋學號/i);
    fireEvent.change(input, { target: { value: 'nonexistent' } });
    
    expect(screen.queryByText('找不到符合的學員')).not.toBeNull();
  });

  it('locks background scrolling while open and restores it when closed', () => {
    document.documentElement.style.overflow = 'scroll';
    const { unmount } = render(<QuickSearch students={students} onSelect={() => {}} onClose={() => {}} />);

    expect(document.documentElement.style.overflow).toBe('hidden');

    unmount();
    expect(document.documentElement.style.overflow).toBe('scroll');
  });
});
