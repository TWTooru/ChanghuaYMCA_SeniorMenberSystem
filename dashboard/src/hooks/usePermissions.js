// src/hooks/usePermissions.js
import { useMemo } from 'react'

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
  },
}

export function getPermissions(role) {
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.viewer
}

export default function usePermissions(role) {
  return useMemo(() => getPermissions(role), [role])
}
