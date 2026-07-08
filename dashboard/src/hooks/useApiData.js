import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { fetchDashboardData } from '../services/dashboardDataService'

export default function useApiData(session, refreshCount) {
  const [dbData, setDbData] = useState({ students: [], enrollments: [] })
  const [dbStatus, setDbStatus] = useState('connecting')
  const [dbError, setDbError] = useState(null)

  useEffect(() => {
    if (!session) return;
    setDbStatus('connecting')
    
    async function fetchData() {
      try {
        const dashboardData = await fetchDashboardData(supabase)
        setDbData(dashboardData)
        setDbStatus('connected')
        setDbError(null)
      } catch (err) {
        console.warn('Supabase data source not available:', err)
        setDbData({ students: [], enrollments: [] })
        setDbStatus('offline')
        setDbError('無法連接 Supabase 資料庫，目前未載入任何個資備份資料。' + err.message)
      }
    }
    
    fetchData()
  }, [refreshCount, session])

  return { dbData, dbStatus, dbError }
}
