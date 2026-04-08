import { useNewVersionCheck } from '@/hooks/useNewVersionCheck'

export function UpdateBanner() {
  const { updateAvailable, updateServiceWorker } = useNewVersionCheck()

  if (!updateAvailable) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between gap-3 bg-primary px-4 py-3 shadow-lg sm:bottom-4 sm:left-4 sm:right-4 sm:rounded-xl">
      <div className="flex items-center gap-2">
        <span className="text-lg">🐑</span>
        <p className="text-sm font-medium text-white">Nova versão disponível</p>
      </div>
      <button
        onClick={() => { updateServiceWorker(false); window.location.href = '/' }}
        className="shrink-0 rounded-lg bg-white px-4 py-1.5 text-sm font-bold text-primary hover:bg-white/90 transition-colors"
      >
        Atualizar
      </button>
    </div>
  )
}
