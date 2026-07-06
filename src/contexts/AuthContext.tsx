import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Room } from '@/store/types'

export type UserRole = 'admin' | 'reception' | 'tia'

export interface TiaClaimResult {
  churchName: string
  rooms: Room[]
}

interface AuthContextValue {
  /** true enquanto a sessão inicial e a identidade ainda estão carregando */
  loading: boolean
  session: Session | null
  role: UserRole | null
  /** staff (admin ou reception) — atalho para guards */
  isStaff: boolean
  churchId: string | null
  /** sala vinculada à sessão da tia (null para staff) */
  tiaRoom: string | null
  signInReception: (email: string, password: string) => Promise<void>
  signInTia: (code: string) => Promise<TiaClaimResult>
  setTiaRoom: (roomId: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

interface Identity {
  role: UserRole | null
  churchId: string | null
  tiaRoom: string | null
}

const NO_IDENTITY: Identity = { role: null, churchId: null, tiaRoom: null }

async function fetchIdentity(session: Session | null): Promise<Identity> {
  if (!session) return NO_IDENTITY

  const { data: profile } = await supabase
    .from('profiles')
    .select('church_id, role')
    .eq('user_id', session.user.id)
    .maybeSingle()

  if (profile) {
    // O CHECK do banco garante 'admin' | 'reception'; o tipo gerado é string
    return { role: profile.role as UserRole, churchId: profile.church_id, tiaRoom: null }
  }

  const { data: tia } = await supabase
    .from('tia_sessions')
    .select('church_id, room_id, expires_at')
    .eq('user_id', session.user.id)
    .maybeSingle()

  if (tia && new Date(tia.expires_at).getTime() > Date.now()) {
    return { role: 'tia', churchId: tia.church_id, tiaRoom: tia.room_id }
  }

  return NO_IDENTITY
}

/** Mapeia os erros das RPCs para mensagens amigáveis */
function tiaClaimError(message: string): Error {
  if (message.includes('INVALID_CODE')) return new Error('Código incorreto')
  if (message.includes('RATE_LIMITED')) return new Error('Muitas tentativas — aguarde alguns minutos')
  if (message.includes('AMBIGUOUS_CODE')) return new Error('Código em conflito — peça à recepção para gerar um novo')
  return new Error('Não foi possível entrar. Verifique sua conexão.')
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [identity, setIdentity] = useState<Identity>(NO_IDENTITY)
  // Evita que uma resposta antiga de fetchIdentity sobrescreva uma mais nova
  const identityEpoch = useRef(0)

  useEffect(() => {
    const applySession = async (next: Session | null) => {
      const epoch = ++identityEpoch.current
      setSession(next)
      const id = await fetchIdentity(next)
      if (identityEpoch.current === epoch) {
        setIdentity(id)
        setLoading(false)
      }
    }

    supabase.auth.getSession().then(({ data }) => applySession(data.session))

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      // TOKEN_REFRESHED não muda identidade; evita refetch desnecessário
      if (event === 'TOKEN_REFRESHED') {
        setSession(next)
        return
      }
      applySession(next)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const signInReception = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error('E-mail ou senha incorretos')
    const id = await fetchIdentity(data.session)
    if (!id.role || id.role === 'tia') {
      await supabase.auth.signOut()
      throw new Error('Esta conta não está vinculada a nenhuma igreja')
    }
    setSession(data.session)
    setIdentity(id)
  }

  const signInTia = async (code: string): Promise<TiaClaimResult> => {
    // Reaproveita sessão anônima existente; staff logado troca para anônima
    let current = (await supabase.auth.getSession()).data.session
    if (!current || !current.user.is_anonymous) {
      if (current) await supabase.auth.signOut()
      const { data, error } = await supabase.auth.signInAnonymously()
      if (error || !data.session) {
        throw new Error('Não foi possível iniciar a sessão. Verifique sua conexão.')
      }
      current = data.session
    }

    const { data, error } = await supabase.rpc('tia_claim', { p_code: code })
    if (error) throw tiaClaimError(error.message)

    const result = data as unknown as { church_id: string; church_name: string; rooms: Room[] }
    setSession(current)
    setIdentity({ role: 'tia', churchId: result.church_id, tiaRoom: null })
    return { churchName: result.church_name, rooms: result.rooms ?? [] }
  }

  const setTiaRoom = async (roomId: string) => {
    const { error } = await supabase.rpc('tia_set_room', { p_room_id: roomId })
    if (error) throw new Error('Não foi possível selecionar a sala')
    setIdentity((prev) => ({ ...prev, tiaRoom: roomId }))
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setIdentity(NO_IDENTITY)
  }

  return (
    <AuthContext.Provider
      value={{
        loading,
        session,
        role: identity.role,
        isStaff: identity.role === 'admin' || identity.role === 'reception',
        churchId: identity.churchId,
        tiaRoom: identity.tiaRoom,
        signInReception,
        signInTia,
        setTiaRoom,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}
