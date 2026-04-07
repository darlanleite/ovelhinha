import { useEffect, useState } from 'react'

const POLL_INTERVAL = 5 * 60 * 1000 // 5 minutos

async function fetchBundleId(): Promise<string | null> {
  try {
    const res = await fetch('/?_v=' + Date.now(), { cache: 'no-store' })
    const html = await res.text()
    // O Vite embute o hash do bundle no src do script — muda a cada deploy
    const match = html.match(/src="\/assets\/index-[^"]+\.js"/)
    return match ? match[0] : null
  } catch {
    return null
  }
}

export function useNewVersionCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    let initialId: string | null = null
    let cancelled = false

    fetchBundleId().then((id) => { initialId = id })

    const interval = setInterval(async () => {
      if (cancelled) return
      const current = await fetchBundleId()
      if (initialId && current && current !== initialId) {
        setUpdateAvailable(true)
        clearInterval(interval)
      }
    }, POLL_INTERVAL)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  return updateAvailable
}
