// src/hooks/usePermissions.js
import { useMemo } from 'react'

/**
 * 將角色映射為 UI 顯示與操作提示。這些旗標不是安全邊界，
 * 後端 mutation 仍由 RLS、RPC 或 Edge Function 再次授權。
 */
const ROLE_PERMISSIONS = {
  viewer: {
    canViewData: true,
    canExportExcel: true,
    canAddStudent: false,
    canEditStudent: false,
    canDeleteStudent: false,
    canAddEnrollment: false,
    canEditEnrollment: false,
    canDeleteEnrollment: false,
    canSyncExcel: false,
    canRefreshSync: false,
    canManageUsers: false,
    canManageCourses: false,
    canViewFaq: false,
  },
  editor: {
    canViewData: true,
    canExportExcel: true,
    canAddStudent: true,
    canEditStudent: true,
    canDeleteStudent: false,
    canAddEnrollment: true,
    canEditEnrollment: true,
    canDeleteEnrollment: false,
    canSyncExcel: true,
    canRefreshSync: true,
    canManageUsers: false,
    canManageCourses: false,
    canViewFaq: false,
  },
  admin: {
    canViewData: true,
    canExportExcel: true,
    canAddStudent: true,
    canEditStudent: true,
    canDeleteStudent: true,
    canAddEnrollment: true,
    canEditEnrollment: true,
    canDeleteEnrollment: true,
    canSyncExcel: true,
    canRefreshSync: true,
    canManageUsers: true,
    canManageCourses: true,
    canViewFaq: true,
  },
}

export function getPermissions(role) {
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.viewer
}

export default function usePermissions(role) {
  return useMemo(() => getPermissions(role), [role])
}
