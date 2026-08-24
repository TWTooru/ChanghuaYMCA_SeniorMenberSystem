const STORED_ROLES = new Set(['viewer', 'editor', 'admin', 'owner'])
const ROLE_ERROR_CODES = new Set(['ROLE_NOT_ASSIGNED', 'ROLE_STORE_ERROR'])

export function parseStoredRole(value) {
  return typeof value === 'string' && STORED_ROLES.has(value) ? value : null
}

export class RoleLookupError extends Error {
  constructor(code) {
    const safeCode = ROLE_ERROR_CODES.has(code) ? code : 'ROLE_STORE_ERROR'
    super(safeCode)
    this.name = 'RoleLookupError'
    this.code = safeCode
  }
}

export async function fetchStoredRole(client, userId) {
  if (typeof userId !== 'string' || userId.trim() === '') {
    throw new RoleLookupError('ROLE_STORE_ERROR')
  }

  let result
  try {
    result = await client
      .from('app_user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle()
  } catch {
    throw new RoleLookupError('ROLE_STORE_ERROR')
  }

  const isBoundaryResult = result !== null
    && typeof result === 'object'
    && !Array.isArray(result)
    && Object.prototype.hasOwnProperty.call(result, 'data')
    && Object.prototype.hasOwnProperty.call(result, 'error')

  if (!isBoundaryResult || result.error !== null) {
    throw new RoleLookupError('ROLE_STORE_ERROR')
  }

  const hasValidRowShape = result.data === null
    || (typeof result.data === 'object' && !Array.isArray(result.data))
  if (!hasValidRowShape) {
    throw new RoleLookupError('ROLE_STORE_ERROR')
  }

  const role = parseStoredRole(result.data?.role)
  if (!role) {
    throw new RoleLookupError('ROLE_NOT_ASSIGNED')
  }

  return role
}
