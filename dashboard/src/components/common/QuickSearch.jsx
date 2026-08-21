import { useMemo, useRef, useState } from 'react'
import useModalA11y from '../../hooks/useModalA11y'
import './quickSearch.css'

const normalize = value => String(value ?? '').toLocaleLowerCase('zh-Hant')

export default function QuickSearch({ students = [], onSelect, onClose }) {
  const panelRef = useRef(null)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  useModalA11y(panelRef, onClose)

  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('zh-Hant')
    if (!normalizedQuery) return []

    return students
      .filter(student => [student.student_id, student.name, student.mobile_phone]
        .some(value => normalize(value).includes(normalizedQuery)))
      .slice(0, 10)
  }, [query, students])

  const selectStudent = student => {
    onSelect(student)
    onClose()
  }

  const handleQueryChange = event => {
    setQuery(event.target.value)
    setActiveIndex(0)
  }

  const handleKeyDown = event => {
    if (event.key === 'ArrowDown' && results.length) {
      event.preventDefault()
      setActiveIndex(index => (index + 1) % results.length)
    }
    if (event.key === 'ArrowUp' && results.length) {
      event.preventDefault()
      setActiveIndex(index => (index - 1 + results.length) % results.length)
    }
    if (event.key === 'Enter' && results[activeIndex]) {
      event.preventDefault()
      selectStudent(results[activeIndex])
    }
  }

  return (
    <div className="quick-search-backdrop">
      <section ref={panelRef} className="quick-search-panel" role="dialog" aria-modal="true" aria-labelledby="quick-search-title">
        <h2 id="quick-search-title">搜尋學生</h2>
        <input
          type="search"
          role="searchbox"
          value={query}
          onChange={handleQueryChange}
          onKeyDown={handleKeyDown}
          placeholder="輸入學號、姓名或手機號碼"
          aria-label="搜尋學生"
        />

        {query.trim() && results.length === 0 && <p className="quick-search-empty">找不到符合的學生</p>}
        {results.length > 0 && (
          <div className="quick-search-results" role="listbox" aria-label="學生搜尋結果">
            {results.map((student, index) => (
              <button
                key={String(student.student_id)}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={index === activeIndex ? 'active' : ''}
                onClick={() => selectStudent(student)}
              >
                <span>{String(student.name ?? '')}</span>
                <small>{String(student.student_id ?? '')} · {String(student.mobile_phone ?? '')}</small>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
