/**
 * 為 Edge Function 建立可攜帶憑證的 CORS 回應標頭。
 * 呼叫端會傳入已驗證的 dashboard origin；不可改成 `*`，否則瀏覽器不會搭配 bearer credentials 傳送請求。
 */
export function createCorsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}
