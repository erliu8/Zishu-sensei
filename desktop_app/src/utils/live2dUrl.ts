let live2dBaseUrl: string | null = null

export function setLive2dBaseUrl(baseUrl: string) {
  live2dBaseUrl = baseUrl.replace(/\/+$/, '')
}

export function getLive2dBaseUrl(): string | null {
  return live2dBaseUrl
}

function isAbsoluteUrl(url: string): boolean {
  return /^(https?:|zishu:|tauri:|asset:|blob:|data:)/i.test(url)
}

export function resolveLive2dUrl(pathOrUrl: string): string
export function resolveLive2dUrl(pathOrUrl: string | undefined): string | undefined
export function resolveLive2dUrl(pathOrUrl?: string): string | undefined {
  if (!pathOrUrl) return pathOrUrl
  if (isAbsoluteUrl(pathOrUrl)) return pathOrUrl

  if (pathOrUrl.startsWith('/live2d_models/')) {
    const base = live2dBaseUrl
    if (!base) return pathOrUrl
    return `${base}${pathOrUrl}`
  }

  return pathOrUrl
}
