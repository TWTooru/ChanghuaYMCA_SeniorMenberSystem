import React, { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';
import './quickSearch.css';

export default function QuickSearch({ students = [], onSelect, onClose }) {
  useBodyScrollLock(true);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = React.useMemo(() => {
    if (!query.trim()) return [];
    const lowerQuery = query.toLowerCase();
    return students
      .filter(
        (s) =>
          (s.student_id && s.student_id.toLowerCase().includes(lowerQuery)) ||
          (s.name && s.name.toLowerCase().includes(lowerQuery)) ||
          (s.phone && s.phone.toLowerCase().includes(lowerQuery)) ||
          (s.email && s.email.toLowerCase().includes(lowerQuery))
      )
      .slice(0, 10);
  }, [query, students]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        onSelect(results[selectedIndex]);
        onClose();
      }
    }
  };

  return (
    <div className="quick-search-overlay" role="dialog" aria-modal="true" aria-label="快速搜尋學員" onClick={onClose}>
      <div className="quick-search-panel" onClick={(e) => e.stopPropagation()}>
        <div className="quick-search-header">
          <Search size={20} className="search-icon" />
          <input
            ref={inputRef}
            type="text"
            placeholder="搜尋學號、姓名、電話或 Email..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="quick-search-input"
          />
          <button className="close-btn" onClick={onClose} aria-label="關閉">
            <X size={20} />
          </button>
        </div>
        <div className="quick-search-results">
          {query.trim() !== '' && results.length === 0 ? (
            <div className="no-results">找不到符合的學員</div>
          ) : (
            results.map((student, index) => (
              <div
                key={student.student_id}
                className={`quick-search-item ${index === selectedIndex ? 'selected' : ''}`}
                onClick={() => {
                  onSelect(student);
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="item-name">{student.name}</div>
                <div className="item-details">#{student.student_id} · {student.phone}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
