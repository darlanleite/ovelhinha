const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

export async function acionarPulseira(braceletId: string, reason?: string) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/acionar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify({ braceletId, reason })
    })
    return res.ok
  } catch {
    return false
  }
}

export async function encerrarPulseira(braceletId: string) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/encerrar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify({ braceletId })
    })
    return res.ok
  } catch {
    return false
  }
}
