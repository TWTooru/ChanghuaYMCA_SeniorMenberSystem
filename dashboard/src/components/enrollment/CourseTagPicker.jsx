import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import {
  deactivateCourseCatalogEntry,
  fetchCourseCatalog,
  saveCourseCatalogEntry,
} from '../../services/courseCatalogService'
import CourseCatalogManager from './CourseCatalogManager'
import './coursePicker.css'

export default function CourseTagPicker({
  selectedCourseNames = [],
  lockedCourseNames = [],
  onChange,
  canManage,
}) {
  const [catalog, setCatalog] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [managerOpen, setManagerOpen] = useState(false)
  const requestGenerationRef = useRef(0)
  const manageButtonRef = useRef(null)

  const refreshCatalog = useCallback(async () => {
    const requestGeneration = ++requestGenerationRef.current
    setLoading(true)
    setError(false)
    try {
      const nextCatalog = await fetchCourseCatalog(supabase)
      if (requestGeneration !== requestGenerationRef.current) return
      setCatalog(nextCatalog)
    } catch (_loadError) {
      if (requestGeneration !== requestGenerationRef.current) return
      setError(true)
    } finally {
      if (requestGeneration === requestGenerationRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshCatalog()
  }, [refreshCatalog])

  const closeManager = () => {
    setManagerOpen(false)
    requestAnimationFrame(() => manageButtonRef.current?.focus())
  }

  const handleSaveCourse = async courseName => {
    await saveCourseCatalogEntry(supabase, courseName)
    await refreshCatalog()
  }

  const handleDeactivateCourse = async course => {
    await deactivateCourseCatalogEntry(supabase, course.courseCatalogId)
    await refreshCatalog()
  }

  const selectedSet = new Set(selectedCourseNames)
  const lockedSet = new Set(lockedCourseNames)
  const visibleCatalog = catalog.filter(course => course.active || selectedSet.has(course.courseName))
  const legacySelections = selectedCourseNames
    .filter(name => !catalog.some(course => course.courseName === name))
    .map(name => ({ courseCatalogId: `legacy:${name}`, courseName: name, active: false }))
  const visibleCourses = [...visibleCatalog, ...legacySelections]

  const toggleCourse = courseName => {
    if (lockedSet.has(courseName)) return
    const selected = new Set(selectedCourseNames)
    if (selected.has(courseName)) selected.delete(courseName)
    else selected.add(courseName)
    onChange([...selected])
  }

  return (
    <section className="course-tag-picker" aria-label="課程選擇">
      <div className="course-tag-picker-header">
        <span className="form-label">課程</span>
        {canManage && (
          <button
            ref={manageButtonRef}
            type="button"
            className="btn-secondary course-tag-picker-manage"
            onClick={() => setManagerOpen(true)}
          >
            管理課程
          </button>
        )}
      </div>

      {loading && <p className="course-tag-picker-message" role="status">載入課程中…</p>}
      {error && (
        <div className="course-tag-picker-error" role="alert">
          <span>課程名單載入失敗</span>
          <button type="button" className="btn-secondary" onClick={refreshCatalog}>重試</button>
        </div>
      )}
      {!loading && !error && (
        <div className="course-tag-list">
          {visibleCourses.map(course => {
            const selected = selectedSet.has(course.courseName)
            const locked = selected && lockedSet.has(course.courseName)
            return (
              <button
                type="button"
                key={course.courseCatalogId}
                className={`course-tag-picker-tag${selected ? ' selected' : ''}${course.active ? '' : ' inactive'}${locked ? ' locked' : ''}`}
                aria-pressed={selected}
                disabled={locked}
                onClick={() => toggleCourse(course.courseName)}
              >
                <span>{course.courseName}</span>
                {!course.active && <span className="course-tag-picker-marker">已停用</span>}
                {locked && <span className="course-tag-picker-marker">已開立收據</span>}
              </button>
            )
          })}
        </div>
      )}

      {managerOpen && canManage && (
        <CourseCatalogManager
          catalog={catalog}
          onSaveCourse={handleSaveCourse}
          onDeactivateCourse={handleDeactivateCourse}
          onClose={closeManager}
        />
      )}
    </section>
  )
}
