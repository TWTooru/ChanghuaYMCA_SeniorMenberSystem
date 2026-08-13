export function detectPasswordFlow(locationLike) {
  const callbackParams = new URLSearchParams(locationLike?.hash?.replace(/^#/, ''))
  const isInviteCallback = callbackParams.get('type') === 'invite'
    && callbackParams.has('access_token')
    && callbackParams.has('refresh_token')

  if (isInviteCallback) return 'invite'
  if (locationLike?.pathname !== '/set-password') return null

  const flow = new URLSearchParams(locationLike.search).get('flow')
  return flow === 'invite' || flow === 'recovery' ? flow : null
}
