import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

const DEVICE_ID_KEY = 'ovelhinha-device-id'
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string

function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

async function upsertSubscription(
  sub: PushSubscription,
  churchId: string,
  role: string,
  roomId: string | null
) {
  const deviceId = getOrCreateDeviceId()
  // A edge function espera role 'reception' ou 'tia' (admin recebe como recepção)
  const pushRole = role === 'tia' ? 'tia' : 'reception'
  await supabase.from('push_subscriptions').upsert(
    {
      church_id: churchId,
      device_id: deviceId,
      role: pushRole,
      room_id: roomId || null,
      subscription: sub.toJSON() as never,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'device_id' }
  )
}

export function usePushNotifications() {
  const { role, churchId, tiaRoom } = useAuth()

  const isSupported = typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window

  const [permission, setPermission] = useState<NotificationPermission>(
    isSupported ? Notification.permission : 'denied'
  )
  const [isSubscribed, setIsSubscribed] = useState(false)

  // Re-inscreve quando a sala da tia muda (garante room_id atualizado)
  useEffect(() => {
    if (!isSupported || !role || !churchId || permission !== 'granted') return
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await upsertSubscription(sub, churchId, role, tiaRoom)
        setIsSubscribed(true)
      }
    })
  }, [role, churchId, tiaRoom, permission, isSupported])

  const subscribe = useCallback(async () => {
    if (!isSupported || !role || !churchId) return
    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') return

      const reg = await navigator.serviceWorker.ready
      let sub = await reg.pushManager.getSubscription()
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        })
      }
      await upsertSubscription(sub, churchId, role, tiaRoom)
      setIsSubscribed(true)
    } catch (err) {
      console.error('[Push] Erro ao ativar notificações:', err)
    }
  }, [isSupported, role, churchId, tiaRoom])

  return { isSupported, permission, isSubscribed, subscribe }
}
