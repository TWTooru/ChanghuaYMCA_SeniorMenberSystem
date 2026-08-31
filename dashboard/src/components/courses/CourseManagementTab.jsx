import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import {
  deactivateCourseCatalogEntry,
  fetchCourseCatalog,
  saveCourseCatalogEntry,
} from '../../services/courseCatalogService'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import './courseManagement.css'

export default function CourseManagementTab() {
  const [catalog, setCatalog] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [courseName, setCourseName] = useState('')
  const [pending, setPending] = useState(false)
  const [filter, setFilter] = useState('all') // 'all' | 'active' | 'inactive'
  const [confirmingCourse, setConfirmingCourse] = useState(null)
  const requestGenerationRef = useRef(0)

  const refreshCatalog = useCallback(async () => {
    const generation = ++requestGenerationRef.current
    setLoading(true)
    setError('')
    try {
      const data = await fetchCourseCatalog(supabase)
      if (generation !== requestGenerationRef.current) return
      setCatalog(data)
    } catch {
      if (generation !== requestGenerationRef.current) return
      setError('課程名單載入失敗')
    } finally {
      if (generation === requestGenerationRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => { refreshCatalog() }, [refreshCatalog])

  const handleSave = async () => {
    if (pending || !courseName.trim()) return
    setPending(true)
    setError('')
    try {
      await saveCourseCatalogEntry(supabase, courseName)
      setCourseName('')
      await refreshCatalog()
    } catch (saveError) {
      setError(saveError.message || '課程儲存失敗')
    } finally {
      setPending(false)
    }
  }

  const handleDeactivate = async () => {
    if (!confirmingCourse || pending) return
    setPending(true)
    setError('')
    try {
      await deactivateCourseCatalogEntry(supabase, confirmingCourse.courseCatalogId)
      setConfirmingCourse(null)
      await refreshCatalog()
    } catch (deactivateError) {
      setError(deactivateError.message || '課程停用失敗')
    } finally {
      setPending(false)
    }
  }

  const filteredCatalog = catalog.filter(course => {
    if (filter === 'active') return course.active
    if (filter === 'inactive') return !course.active
    return true
  })

  const activeCourseCount = catalog.filter(c => c.active).length
  const inactiveCourseCount = catalog.filter(c => !c.active).length

  return (
    <div className="course-management">
      <div className="course-management-header">
        <h2>課程目錄管理</h2>
        <span>啟用 {activeCourseCount} 門 · 停用 {inactiveCourseCount} 門</span>
      </div>

      <div className="course-management-add-form">
        <Input
          className="h-10 form-input"
          placeholder="輸入課程名稱以新增或重新啟用"
          value={courseName}
          onChange={e => setCourseName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSave() } }}
          disabled={pending}
        />
        <Button onClick={handleSave} disabled={pending || !courseName.trim()}>
          {pending ? '處理中…' : '新增 / 重新啟用'}
        </Button>
      </div>

      {error && <p role="alert" style={{ color: 'var(--color-danger, #dc2626)' }}>{error}</p>}

      {confirmingCourse && (
        <div className="course-catalog-confirmation" role="status">
          <p>確定要停用「{confirmingCourse.courseName}」嗎？停用後不會刪除既有歷史資料。</p>
          <div className="course-catalog-confirmation-actions">
            <Button variant="outline" onClick={() => setConfirmingCourse(null)} disabled={pending}>取消</Button>
            <Button variant="destructive" onClick={handleDeactivate} disabled={pending}>
              {pending ? '處理中…' : '確認停用'}
            </Button>
          </div>
        </div>
      )}

      <div className="course-management-filter-group">
        {['all', 'active', 'inactive'].map(f => (
          <Button
            key={f}
            variant={filter === f ? 'default' : 'outline'}
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
          >
            {{ all: '全部', active: '啟用中', inactive: '已停用' }[f]}
          </Button>
        ))}
      </div>

      {loading && <p>載入中…</p>}
      {!loading && filteredCatalog.length === 0 && (
        <p className="course-management-empty">沒有符合條件的課程</p>
      )}
      {!loading && filteredCatalog.length > 0 && (
        <div className="course-management-table-wrapper">
          <Table className="course-management-table" aria-label="課程目錄">
            <TableHeader>
              <TableRow>
                <TableHead>課程名稱</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCatalog.map(course => (
                <TableRow key={course.courseCatalogId}>
                  <TableCell>{course.courseName}</TableCell>
                  <TableCell>
                    <Badge variant={course.active ? 'default' : 'secondary'} className={`course-management-status ${course.active ? 'active' : 'inactive'}`}>
                      {course.active ? '啟用中' : '已停用'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {course.active ? (
                      <Button
                        variant="outline"
                        onClick={() => setConfirmingCourse(course)}
                        disabled={pending}
                      >
                        停用
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={async () => {
                          setPending(true)
                          setError('')
                          try {
                            await saveCourseCatalogEntry(supabase, course.courseName)
                            await refreshCatalog()
                          } catch (err) {
                            setError(err.message || '重新啟用失敗')
                          } finally {
                            setPending(false)
                          }
                        }}
                        disabled={pending}
                      >
                        重新啟用
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
