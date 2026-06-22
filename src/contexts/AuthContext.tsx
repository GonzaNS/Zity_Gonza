import { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import {
  sesionFueInvalidada,
  marcaInvalidaSesion,
  pausarVerificacionSesion,
  estaVerificacionPausada,
} from '../lib/sesionUnica'
import type { Profile, SignUpMetadata, EstadoCuenta } from '../types/database'

type AuthState = {
  user: User | null
  profile: Profile | null
  session: Session | null
  loading: boolean
  isRecovery: boolean
}

type AuthActions = {
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, metadata: SignUpMetadata) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: string | null }>
  updatePassword: (password: string) => Promise<{ error: string | null }>
  /**
   * Sprint 5 · PBI-S2-E03
   * Refresca el `profile` desde la BD tras una edición en /perfil.
   * El llamador no necesita lanzar excepciones: si el fetch falla, el
   * profile previo se conserva.
   */
  refreshProfile: () => Promise<void>
}

type AuthContextType = AuthState & AuthActions

const AuthContext = createContext<AuthContextType | null>(null)

const PROFILE_FETCH_TIMEOUT_MS = 6000
const SIGN_IN_TIMEOUT_MS = 8000
const PROFILE_COLUMNS = 'id, email, nombre, apellido, telefono, rol, piso, departamento, estado_cuenta, empresa_tercero, sesion_unica_id, created_at, updated_at'

const isDev = import.meta.env.DEV

// Base URL para los enlaces que Supabase incluye en correos (verificación, reset).
function getSiteUrl(): string {
  const fromEnv = import.meta.env.VITE_SITE_URL as string | undefined
  if (fromEnv && fromEnv.length > 0) return fromEnv.replace(/\/$/, '')
  return window.location.origin
}

const ESTADO_CUENTA_MENSAJES: Record<Exclude<EstadoCuenta, 'activo'>, string> = {
  pendiente: 'Tu cuenta está pendiente de aprobación. Un administrador debe activarla antes de que puedas ingresar.',
  bloqueado: 'Tu cuenta está bloqueada. Contacta al administrador para más información.',
}

async function fetchProfileSafe(userId: string): Promise<Profile | null> {
  try {
    const queryPromise = supabase
      .from('usuarios')
      .select(PROFILE_COLUMNS)
      .eq('id', userId)
      .single()

    const timeoutPromise = new Promise<{ data: null; error: { message: string } }>(resolve =>
      setTimeout(
        () => resolve({ data: null, error: { message: 'Profile fetch timeout' } }),
        PROFILE_FETCH_TIMEOUT_MS,
      ),
    )

    const { data, error } = await Promise.race([queryPromise, timeoutPromise])

    if (error) {
      if (isDev) console.warn('[Auth] fetchProfile error:', error.message)
      return null
    }
    return data as Profile
  } catch (err) {
    if (isDev) console.warn('[Auth] fetchProfile failed:', (err as Error).message)
    return null
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    session: null,
    loading: true,
    isRecovery: false,
  })

  const mountedRef = useRef(true)
  // Guarda el último userId para el que ya tenemos profile cargado. Evita refetch
  // redundante en cada TOKEN_REFRESHED (cada hora) y en cada pestaña abierta.
  const profileUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    mountedRef.current = true

    // Safety timeout: si en 10s no llegó ningún evento, forzar loading:false.
    const safetyTimeout = setTimeout(() => {
      if (!mountedRef.current) return
      if (isDev) console.warn('[Auth] Safety timeout: no auth event received in 10s, forcing loading=false')
      setState(prev => (prev.loading ? { ...prev, loading: false } : prev))
    }, 10000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mountedRef.current) return

        if (event === 'PASSWORD_RECOVERY') {
          profileUserIdRef.current = null
          setState(prev => ({
            ...prev,
            isRecovery: true,
            loading: false,
            session,
            user: session?.user ?? null,
            profile: null,
          }))
          return
        }

        if (event === 'SIGNED_OUT') {
          profileUserIdRef.current = null
          setState({
            user: null,
            profile: null,
            session: null,
            loading: false,
            isRecovery: false,
          })
          return
        }

        if (!session?.user) {
          profileUserIdRef.current = null
          setState({
            user: null,
            profile: null,
            session: null,
            loading: false,
            isRecovery: false,
          })
          return
        }

        // Camino rápido: cualquier evento (TOKEN_REFRESHED, SIGNED_IN re-emitido,
        // INITIAL_SESSION en otra pestaña…) para el mismo usuario que ya
        // tenemos cargado. Solo actualizamos session/user sin re-pegar la red.
        // Sin esto, un fetch lento o un blip de red dejaría profile=null y
        // ProtectedRoute mandaría al usuario al login sin razón real.
        if (profileUserIdRef.current === session.user.id) {
          setState(prev => ({
            ...prev,
            user: session.user,
            session,
            loading: false,
          }))
          return
        }

        // INITIAL_SESSION, SIGNED_IN, USER_UPDATED de un usuario nuevo (o
        // recuperación de la primera carga). Aquí sí necesitamos el profile.
        const profile = await fetchProfileSafe(session.user.id)
        if (!mountedRef.current) return

        // PBI-S6-E03 — Al cargar la app (INITIAL_SESSION) comprobamos si esta
        // sesión fue invalidada por un "cerrar otras sesiones"/cambio de
        // contraseña en otro dispositivo; de ser así la cerramos en vez de
        // autenticar. Los logins frescos (SIGNED_IN) limpian la marca en signIn,
        // y la verificación periódica/foco cubre las sesiones ya abiertas.
        if (
          event === 'INITIAL_SESSION' &&
          profile &&
          !estaVerificacionPausada() &&
          marcaInvalidaSesion(profile.sesion_unica_id, session)
        ) {
          profileUserIdRef.current = null
          void supabase.auth.signOut({ scope: 'local' })
          return
        }

        // Si el fetch falla pero teníamos un profile válido del mismo usuario,
        // mantenemos el anterior en lugar de tirar al login. Sólo un evento
        // SIGNED_OUT explícito o un cambio real de usuario debe limpiar el
        // profile.
        setState(prev => {
          if (!profile && prev.profile && prev.profile.id === session.user.id) {
            return { ...prev, user: session.user, session, loading: false, isRecovery: false }
          }
          return {
            user: session.user,
            profile,
            session,
            loading: false,
            isRecovery: false,
          }
        })

        if (profile) profileUserIdRef.current = session.user.id
      }
    )

    return () => {
      mountedRef.current = false
      clearTimeout(safetyTimeout)
      subscription.unsubscribe()
    }
  }, [])

  // PBI-S6-E03 — Verificación activa periódica + al recuperar el foco. Hace
  // PERCEPTIBLE el cierre disparado desde otro dispositivo: en cuanto esta
  // pestaña vuelve a estar visible (o cada 45 s) comprueba si su sesión fue
  // invalidada y, de ser así, cierra la sesión local. Sin esto habría que
  // esperar a que expire el access token (~1 h).
  useEffect(() => {
    const INTERVALO_MS = 45_000

    async function verificar() {
      const { data } = await supabase.auth.getSession()
      const session = data.session
      if (!session || !mountedRef.current) return
      if (await sesionFueInvalidada(session)) {
        if (!mountedRef.current) return
        await supabase.auth.signOut({ scope: 'local' })
      }
    }

    const interval = setInterval(() => { void verificar() }, INTERVALO_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void verificar()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [])

  // signIn devuelve error si:
  // 1. Las credenciales son inválidas (Supabase responde con error)
  // 2. La cuenta está pendiente o bloqueada (validamos antes de dejar sesión activa)
  // En ambos casos el cliente queda sin sesión, por lo que el botón del Login
  // puede resetear su estado de carga sin depender de GuestRoute para redirigir.
  //
  // Multi-tab: si el cliente está abierto en dos pestañas, supabase-js usa un
  // lock compartido (localStorage + navigator.locks) para serializar las ops
  // de auth. Si la otra pestaña tomó el lock primero o lo está reteniendo, el
  // signInWithPassword puede no resolver. En ese caso confiamos en el evento
  // SIGNED_IN que dispara onAuthStateChange (vía storage sync) para que
  // GuestRoute redirija — devolvemos sin error tras el timeout.
  const signIn = useCallback(async (email: string, password: string) => {
    type SignInResult = Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>

    // PBI-S6-E03 — Pausamos la verificación de sesión única mientras se crea la
    // sesión nueva, para que el intervalo/foco no la cierre por la marca que dejó
    // un "cerrar otras sesiones" anterior. Tras autenticar limpiamos esa marca.
    pausarVerificacionSesion(true)
    try {
      const timeoutResult: { timedOut: true } = { timedOut: true }
      const race = await Promise.race<SignInResult | { timedOut: true }>([
        supabase.auth.signInWithPassword({ email, password }),
        new Promise(resolve => setTimeout(() => resolve(timeoutResult), SIGN_IN_TIMEOUT_MS)),
      ])

      if ('timedOut' in race) {
        // Otra pestaña pudo haber resuelto la sesión por nosotros; el evento
        // SIGNED_IN dispará en cuanto se sincronice el storage. No mostramos
        // error: si en realidad falló, el usuario verá que sigue en /login y
        // podrá reintentar.
        return { error: null }
      }

      const { data, error } = race

      if (error) {
        if (error.message.includes('Email not confirmed')) {
          return { error: 'Debes verificar tu correo electrónico antes de iniciar sesión.' }
        }
        if (error.message.includes('Invalid login credentials')) {
          return { error: 'Credenciales incorrectas.' }
        }
        return { error: error.message }
      }

      if (!data.user) {
        return { error: 'No pudimos iniciar sesión. Intenta de nuevo.' }
      }

      const profile = await fetchProfileSafe(data.user.id)

      if (!profile) {
        await supabase.auth.signOut({ scope: 'local' })
        return { error: 'No pudimos cargar tu perfil. Contacta al administrador.' }
      }

      if (profile.estado_cuenta !== 'activo') {
        await supabase.auth.signOut({ scope: 'local' })
        return { error: ESTADO_CUENTA_MENSAJES[profile.estado_cuenta] }
      }

      // Login válido: esta sesión nueva es legítima; quitamos cualquier marca de
      // sesión única previa para que no se auto-cierre al verificarse.
      await supabase.rpc('limpiar_sesion_unica')

      return { error: null }
    } finally {
      pausarVerificacionSesion(false)
    }
  }, [])

  const signUp = useCallback(async (email: string, password: string, metadata: SignUpMetadata) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
        emailRedirectTo: `${getSiteUrl()}/email-verified`,
      },
    })
    if (error) {
      if (error.message.includes('already registered')) {
        return { error: 'Este correo electrónico ya está registrado.' }
      }
      return { error: error.message }
    }
    return { error: null }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getSiteUrl()}/reset-password`,
    })
    if (error) return { error: error.message }
    return { error: null }
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) return { error: error.message }
    setState(prev => ({ ...prev, isRecovery: false }))
    return { error: null }
  }, [])

  // Sprint 5 · PBI-S2-E03 — vuelve a leer el profile de la BD y lo refresca
  // en el contexto. La página /perfil lo llama tras un guardado exitoso para
  // que el sidebar y otros consumidores vean los datos al día.
  const refreshProfile = useCallback(async () => {
    const userId = profileUserIdRef.current
    if (!userId) return
    const fresh = await fetchProfileSafe(userId)
    if (fresh && mountedRef.current) {
      setState(prev => ({ ...prev, profile: fresh }))
    }
  }, [])

  const value = useMemo<AuthContextType>(
    () => ({ ...state, signIn, signUp, signOut, resetPassword, updatePassword, refreshProfile }),
    [state, signIn, signUp, signOut, resetPassword, updatePassword, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider')
  }
  return context
}
