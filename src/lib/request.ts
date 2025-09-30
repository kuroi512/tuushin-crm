export function getIpFromHeaders(headers: Headers | Record<string, any> | undefined) {
  if (!headers) return undefined;
  const get = (key: string) => {
    if (headers instanceof Headers) return headers.get(key) || undefined;
    const h = headers as Record<string, any>;
    return (h[key] as string) || (h[key.toLowerCase()] as string) || undefined;
  };
  const xff = get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim();
  const xri = get('x-real-ip');
  if (xri) return xri;
  // Node/Next fallback
  return get('remote-addr') || get('cf-connecting-ip') || undefined;
}

export function getUserAgentFromHeaders(headers: Headers | Record<string, any> | undefined) {
  if (!headers) return undefined;
  if (headers instanceof Headers) return headers.get('user-agent') || undefined;
  const h = headers as Record<string, any>;
  return (h['user-agent'] as string) || (h['User-Agent'] as string) || undefined;
}
