import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { deriveConnectivity } from '@/hooks/useBracelets'
import { computeStatus } from '@/hooks/useGateway'

const NOW = new Date('2026-07-06T12:00:00Z')

function secondsAgo(secs: number): string {
  return new Date(NOW.getTime() - secs * 1000).toISOString()
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('deriveConnectivity (pulseira)', () => {
  it('pulseira fora de uso é sempre considerada online', () => {
    expect(deriveConnectivity({ status: 'available', last_seen_at: null })).toBe('online')
    expect(deriveConnectivity({ status: 'charging', last_seen_at: secondsAgo(500) })).toBe('online')
  })

  it('em uso sem heartbeat → unreachable', () => {
    expect(deriveConnectivity({ status: 'in-use', last_seen_at: null })).toBe('unreachable')
  })

  it('em uso com heartbeat recente (<30s) → online', () => {
    expect(deriveConnectivity({ status: 'in-use', last_seen_at: secondsAgo(10) })).toBe('online')
    expect(deriveConnectivity({ status: 'in-use', last_seen_at: secondsAgo(29) })).toBe('online')
  })

  it('em uso com heartbeat entre 30 e 90s → warning', () => {
    expect(deriveConnectivity({ status: 'in-use', last_seen_at: secondsAgo(31) })).toBe('warning')
    expect(deriveConnectivity({ status: 'in-use', last_seen_at: secondsAgo(89) })).toBe('warning')
  })

  it('em uso com heartbeat acima de 90s → unreachable', () => {
    expect(deriveConnectivity({ status: 'in-use', last_seen_at: secondsAgo(91) })).toBe('unreachable')
    expect(deriveConnectivity({ status: 'in-use', last_seen_at: secondsAgo(3600) })).toBe('unreachable')
  })
})

describe('computeStatus (gateway)', () => {
  it('sem heartbeat → unknown', () => {
    expect(computeStatus(null)).toBe('unknown')
  })

  it('heartbeat recente (<90s) → online', () => {
    expect(computeStatus(secondsAgo(10))).toBe('online')
    expect(computeStatus(secondsAgo(89))).toBe('online')
  })

  it('heartbeat antigo (>=90s) → offline', () => {
    expect(computeStatus(secondsAgo(90))).toBe('offline')
    expect(computeStatus(secondsAgo(600))).toBe('offline')
  })
})
