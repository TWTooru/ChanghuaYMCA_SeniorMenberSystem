import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { fetchDashboardData } from '../services/dashboardDataService'

/**
 * 依登入 session 與 `refreshCount` 載入 dashboard 快照。
 * 失敗時清空個資陣列並回報 `offline`，避免畫面繼續顯示可能過期的資料。
 */
export default function useApiData(session, refreshCount) {
  const [dbData, setDbData] = useState({ students: [], enrollments: [] })
  const [dbStatus, setDbStatus] = useState('connecting')
  const [dbError, setDbError] = useState(null)

  useEffect(() => {
    if (!session) return;
    let isCurrentRequest = true
    setDbStatus('connecting')
    
    async function fetchData() {
      try {
        const dashboardData = await fetchDashboardData(supabase)
        if (!isCurrentRequest) return
        setDbData(dashboardData)
        setDbStatus('connected')
        setDbError(null)
      } catch (err) {
        if (!isCurrentRequest) return
        console.warn('Supabase data source not available:', err)
        setDbData({ students: [], enrollments: [] })
        setDbStatus('offline')
        setDbError('無法連接 Supabase 資料庫，目前未載入任何個資備份資料。' + err.message)
      }
    }
    
    fetchData()
    return () => {
      isCurrentRequest = false
    }
  }, [refreshCount, session])

  return { dbData, dbStatus, dbError }
}
