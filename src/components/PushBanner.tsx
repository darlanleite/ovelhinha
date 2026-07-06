import { useState } from 'react'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { useAuth } from '@/contexts/AuthContext'

export function PushBanner() {
  const userRole = useAuth().role
  const { isSupported, permission, isSubscribed, subscribe } = usePushNotifications()
  const [dismissed, setDismissed] = useState(false)
  const [loading, setLoading] = useState(false)

  if (!userRole || !isSupported || isSubscribed || dismissed) return null
  if (permission === 'granted' || permission === 'denied') return null

  const handleSubscribe = async () => {
    setLoading(true)
    await subscribe()
    setLoading(false)
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between gap-3 bg-foreground px-4 py-3 shadow-lg sm:bottom-16 sm:left-4 sm:right-4 sm:rounded-xl">
      <div className="flex items-center gap-2">
        <span className="text-lg">🔔</span>
        <p className="text-sm font-medium text-background">Ativar notificações no celular?</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleSubscribe}
          disabled={loading}
          className="rounded-lg bg-primary px-4 py-1.5 text-sm font-bold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? '...' : 'Ativar'}
        </button>
        <button onClick={() => setDismissed(true)} className="text-background/60 hover:text-background transition-colors text-lg leading-none">
          ✕
        </button>
      </div>
    </div>
  )
}
