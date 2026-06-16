import { useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { ROLE_ROUTES } from '../lib/routing'
import zityLogo from '../assets/zity_logo.png'
import PasswordInput from '../components/PasswordInput'
import { logAuditAction } from '../lib/audit'
import type { Rol } from '../types/database'
import MisTarjetas from '../components/residente/MisTarjetas'

const NOMBRE_MIN = 2
const NOMBRE_MAX = 80
const TELEFONO_MAX = 20

const ROL_LABEL: Record<Rol, string> = {
  residente: 'Residente',
  tecnico: 'Técnico',
  admin: 'Administrador',
}

const ROL_BADGE_CLS: Record<Rol, string> = {
  residente: 'bg-accent-500',
  tecnico: 'bg-success',
  admin: 'bg-primary-600',
}

export default function Perfil() {
  const { profile, refreshProfile, signOut } = useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<'info' | 'seguridad' | 'sesiones' | 'tarjetas'>('info')

  const [nombre, setNombre] = useState(profile?.nombre ?? '')
  const [apellido, setApellido] = useState(profile?.apellido ?? '')
  const [telefono, setTelefono] = useState(profile?.telefono ?? '')
  const [guardandoInfo, setGuardandoInfo] = useState(false)
  const [errorInfo, setErrorInfo] = useState<string | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [guardandoSeguridad, setGuardandoSeguridad] = useState(false)
  const [errorSeguridad, setErrorSeguridad] = useState<string | null>(null)
  
  const [toast, setToast] = useState<string | null>(null)

  // ─── Estado de sesiones activas (PBI-S6-E03) ─────────────────────────────────
  type SesionInfo = {
    id: string
    user_agent: string
    created_at: string
    ip_address: string | null
    es_actual: boolean
  }
  const [sesiones, setSesiones] = useState<SesionInfo[]>([])
  const [cargandoSesiones, setCargandoSesiones] = useState(false)
  const [errSesiones, setErrSesiones] = useState<string | null>(null)
  const [cerrandoOtras, setCerrandoOtras] = useState(false)

  // Carga las sesiones activas desde el contexto de la sesión actual
  // (Supabase JS client solo expone la sesión actual; listamos 1 sesión
  // enriquecida con el user-agent del cliente + indicador "Esta sesión").
  const cargarSesiones = useCallback(async () => {
    setCargandoSesiones(true)
    setErrSesiones(null)
    const { data, error } = await supabase.auth.getSession()
    if (error || !data.session) {
      setErrSesiones('No se pudo obtener la información de sesión.')
      setCargandoSesiones(false)
      return
    }
    const s = data.session
    setSesiones([{
      id: s.access_token.slice(-8), // sufijo para identificar visualmente
      user_agent: navigator.userAgent,
      created_at: new Date(s.user.last_sign_in_at ?? Date.now()).toISOString(),
      ip_address:  null, // no expuesto por el client SDK
      es_actual: true,
    }])
    setCargandoSesiones(false)
  }, [])

  // Rate Limiting + countdown visual en vivo (PBI-S5-E03)
  const [intentosFallidos, setIntentosFallidos] = useState(0)
  const [bloqueadoHasta, setBloqueadoHasta] = useState<number | null>(null)
  const [ahora, setAhora] = useState(() => Date.now())

  const isBloqueado = bloqueadoHasta !== null && ahora < bloqueadoHasta
  const segundosRestantes = bloqueadoHasta ? Math.max(0, Math.ceil((bloqueadoHasta - ahora) / 1000)) : 0

  useEffect(() => {
    if (!bloqueadoHasta) return
    const interval = setInterval(() => {
      const t = Date.now()
      setAhora(t)
      if (t >= bloqueadoHasta) {
        setBloqueadoHasta(null)
        setIntentosFallidos(0)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [bloqueadoHasta])

  const cambiosInfo = useMemo(() => {
    if (!profile) return null
    const nombreTrim = nombre.trim()
    const apellidoTrim = apellido.trim()
    const telefonoTrim = telefono.trim()

    const hayCambios =
      nombreTrim !== (profile.nombre ?? '').trim() ||
      apellidoTrim !== (profile.apellido ?? '').trim() ||
      telefonoTrim !== (profile.telefono ?? '').trim()

    const validos =
      nombreTrim.length >= NOMBRE_MIN &&
      nombreTrim.length <= NOMBRE_MAX &&
      apellidoTrim.length >= NOMBRE_MIN &&
      apellidoTrim.length <= NOMBRE_MAX &&
      telefonoTrim.length <= TELEFONO_MAX

    return { hayCambios, validos, nombreTrim, apellidoTrim, telefonoTrim }
  }, [nombre, apellido, telefono, profile])

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-warm-50">
        <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    )
  }

  const rolLabel = ROL_LABEL[profile.rol]
  const rolBadge = ROL_BADGE_CLS[profile.rol]
  const volverHref = ROLE_ROUTES[profile.rol]

  async function handleGuardarInfo(e: React.FormEvent) {
    e.preventDefault()
    if (!profile || !cambiosInfo || !cambiosInfo.hayCambios || !cambiosInfo.validos) return

    setGuardandoInfo(true)
    setErrorInfo(null)
    setToast(null)

    const { error: updateError } = await supabase
      .from('usuarios')
      .update({
        nombre: cambiosInfo.nombreTrim,
        apellido: cambiosInfo.apellidoTrim,
        telefono: cambiosInfo.telefonoTrim || null,
      })
      .eq('id', profile.id)

    if (updateError) {
      setErrorInfo(updateError.message)
      setGuardandoInfo(false)
      return
    }

    await refreshProfile()

    setGuardandoInfo(false)
    setToast('Datos actualizados correctamente.')
    setTimeout(() => setToast(null), 3000)
  }

  async function handleGuardarSeguridad(e: React.FormEvent) {
    e.preventDefault()
    if (isBloqueado) return

    if (newPassword.length < 8) {
      setErrorSeguridad('La nueva contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (!/\d/.test(newPassword)) {
      setErrorSeguridad('La nueva contraseña debe incluir al menos un número.')
      return
    }
    if (newPassword === currentPassword) {
      setErrorSeguridad('La nueva contraseña no puede ser igual a la actual.')
      return
    }
    if (newPassword !== confirmPassword) {
      setErrorSeguridad('Las contraseñas nuevas no coinciden.')
      return
    }

    setGuardandoSeguridad(true)
    setErrorSeguridad(null)

    try {
      // Re-auth silencioso
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: profile!.email,
        password: currentPassword,
      })

      if (authError) {
        const nuevosIntentos = intentosFallidos + 1
        setIntentosFallidos(nuevosIntentos)
        
        if (nuevosIntentos >= 3) {
          setBloqueadoHasta(Date.now() + 5 * 60 * 1000) // Bloqueo de 5 min
          setErrorSeguridad('Demasiados intentos fallidos. Intenta nuevamente en 5 minutos.')
        } else {
          setErrorSeguridad(`Contraseña actual incorrecta. Te quedan ${3 - nuevosIntentos} intentos.`)
        }
        setGuardandoSeguridad(false)
        return
      }

      // Si fue exitoso, actualizamos
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (updateError) throw updateError

      // PBI-S5-E03 / OWASP A02 — registrar el evento en audit_log SIN payload
      // de contraseña (solo la acción). Fire-and-forget.
      void logAuditAction(
        { accion: 'cambio_contrasena', entidad: 'usuarios', entidadId: profile!.id },
        profile!.id,
      )

      // PBI-S6-E03 — R3: cerrar automáticamente todas las demás sesiones
      // al cambiar la contraseña (OWASP Session Management Best Practices).
      // scope: 'others' invalida todos los refresh tokens salvo el actual.
      await supabase.auth.signOut({ scope: 'others' })

      setIntentosFallidos(0)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setToast('Contraseña actualizada correctamente.')
      setTimeout(() => setToast(null), 3000)
    } catch (err) {
      setErrorSeguridad((err as Error).message)
    } finally {
      setGuardandoSeguridad(false)
    }
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-warm-50">
      <header className="bg-white border-b border-warm-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img src={zityLogo} alt="Zity" className="h-8 w-auto shrink-0" />
            <span
              className={`text-[0.65rem] font-semibold ${rolBadge} text-white px-2 py-0.5 rounded-full tracking-wider uppercase shrink-0`}
            >
              {rolLabel}
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => navigate(volverHref)}
              className="text-sm text-primary-700 hover:text-primary-900 font-medium cursor-pointer hidden sm:inline"
            >
              ← Volver al panel
            </button>
            <button
              onClick={handleSignOut}
              className="text-sm text-warm-400 hover:text-error transition-colors font-medium whitespace-nowrap cursor-pointer"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="animate-fade-in mb-6">
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-primary-900 tracking-tight">
            Mi perfil
          </h1>
          <p className="mt-1 text-sm text-warm-400">
            Gestiona tu información personal y ajustes de seguridad.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-warm-200 overflow-hidden animate-fade-in delay-1">
          <div className="flex border-b border-warm-200">
            <button
              onClick={() => setActiveTab('info')}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'info'
                  ? 'border-primary-600 text-primary-900'
                  : 'border-transparent text-warm-500 hover:text-warm-700'
              }`}
            >
              Información
            </button>
            <button
              onClick={() => setActiveTab('seguridad')}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'seguridad'
                  ? 'border-primary-600 text-primary-900'
                  : 'border-transparent text-warm-500 hover:text-warm-700'
              }`}
            >
              Seguridad
            </button>
            {/* PBI-S6-E03 — Pestaña Sesiones */}
            <button
              onClick={() => { setActiveTab('sesiones'); void cargarSesiones() }}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'sesiones'
                  ? 'border-primary-600 text-primary-900'
                  : 'border-transparent text-warm-500 hover:text-warm-700'
              }`}
            >
              Sesiones
            </button>
            {/* HU-PAGO-02 — Pestaña Tarjetas (solo residentes) */}
            {profile.rol === 'residente' && (
              <button
                onClick={() => setActiveTab('tarjetas')}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'tarjetas'
                    ? 'border-primary-600 text-primary-900'
                    : 'border-transparent text-warm-500 hover:text-warm-700'
                }`}
              >
                Tarjetas
              </button>
            )}
          </div>

          <div className="p-5 sm:p-6">
            {activeTab === 'info' && (
              <form onSubmit={handleGuardarInfo} className="space-y-4 animate-fade-in">
                <fieldset disabled={guardandoInfo} className="space-y-4">
                  <legend className="text-xs uppercase tracking-wider text-warm-400 font-medium mb-2">
                    Datos personales
                  </legend>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="nombre" className="block text-sm font-medium text-primary-900 mb-1.5">
                        Nombre
                      </label>
                      <input
                        id="nombre"
                        type="text"
                        value={nombre}
                        onChange={e => setNombre(e.target.value)}
                        maxLength={NOMBRE_MAX}
                        required
                        className="w-full h-11 px-3 rounded-lg border border-warm-300 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label htmlFor="apellido" className="block text-sm font-medium text-primary-900 mb-1.5">
                        Apellido
                      </label>
                      <input
                        id="apellido"
                        type="text"
                        value={apellido}
                        onChange={e => setApellido(e.target.value)}
                        maxLength={NOMBRE_MAX}
                        required
                        className="w-full h-11 px-3 rounded-lg border border-warm-300 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-50"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="telefono" className="block text-sm font-medium text-primary-900 mb-1.5">
                      Teléfono
                      <span className="ml-1 font-normal text-warm-400">(opcional)</span>
                    </label>
                    <input
                      id="telefono"
                      type="tel"
                      value={telefono}
                      onChange={e => setTelefono(e.target.value)}
                      maxLength={TELEFONO_MAX}
                      placeholder="+51 999 999 999"
                      className="w-full h-11 px-3 rounded-lg border border-warm-300 text-sm text-primary-900 placeholder:text-warm-300 focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-50"
                    />
                  </div>
                </fieldset>

                <fieldset className="mt-6 pt-5 border-t border-warm-200 space-y-3">
                  <legend className="text-xs uppercase tracking-wider text-warm-400 font-medium mb-2">
                    Datos administrativos (solo lectura)
                  </legend>
                  <ReadonlyRow label="Email" value={profile.email} />
                  <ReadonlyRow label="Rol" value={rolLabel} />
                  {profile.empresa_tercero && (
                    <ReadonlyRow label="Empresa" value={profile.empresa_tercero} />
                  )}
                  {(profile.piso || profile.departamento) && (
                    <ReadonlyRow
                      label="Ubicación"
                      value={`Piso ${profile.piso || '—'} · Depto. ${profile.departamento || '—'}`}
                    />
                  )}
                  <ReadonlyRow
                    label="Estado de cuenta"
                    value={
                      profile.estado_cuenta === 'activo'
                        ? 'Activa'
                        : profile.estado_cuenta === 'pendiente'
                          ? 'Pendiente de activación'
                          : 'Bloqueada'
                    }
                  />
                </fieldset>

                {errorInfo && (
                  <div className="mt-5 p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm">
                    {errorInfo}
                  </div>
                )}

                <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:justify-end">
                  <button
                    type="submit"
                    disabled={guardandoInfo || !cambiosInfo?.hayCambios || !cambiosInfo?.validos}
                    className="h-11 px-6 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {guardandoInfo && (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    )}
                    Guardar cambios
                  </button>
                </div>
              </form>
            )}

            {activeTab === 'seguridad' && (
              <form onSubmit={handleGuardarSeguridad} className="space-y-5 animate-fade-in">
                {isBloqueado ? (
                  <div className="p-4 rounded-lg bg-error/10 border border-error/20 flex items-start gap-3">
                    <svg className="w-5 h-5 text-error mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-error">Seguridad bloqueada</p>
                      <p className="text-xs text-error/80 mt-1">
                        Demasiados intentos fallidos. Podrás intentar de nuevo en{' '}
                        <span className="font-semibold tabular-nums">
                          {Math.floor(segundosRestantes / 60)}:{String(segundosRestantes % 60).padStart(2, '0')}
                        </span>.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <PasswordInput
                      label="Contraseña actual"
                      value={currentPassword}
                      onChange={setCurrentPassword}
                      placeholder="Ingresa tu contraseña actual"
                      required
                    />
                    
                    <div className="border-t border-warm-200 pt-5">
                      <PasswordInput
                        label="Nueva contraseña"
                        value={newPassword}
                        onChange={setNewPassword}
                        placeholder="Mínimo 8 caracteres"
                        required
                      />
                    </div>
                    
                    <PasswordInput
                      label="Confirmar nueva contraseña"
                      value={confirmPassword}
                      onChange={setConfirmPassword}
                      placeholder="Repite la nueva contraseña"
                      required
                    />

                    {errorSeguridad && (
                      <div className="p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm">
                        {errorSeguridad}
                      </div>
                    )}

                    <div className="pt-2 flex justify-end">
                      <button
                        type="submit"
                        disabled={guardandoSeguridad || !currentPassword || !newPassword || !confirmPassword}
                        className="w-full sm:w-auto h-11 px-6 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {guardandoSeguridad && (
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        )}
                        Actualizar contraseña
                      </button>
                    </div>
                  </>
                )}
              </form>
            )}

            {activeTab === 'sesiones' && (
              <SesionePanel
                sesiones={sesiones}
                cargando={cargandoSesiones}
                error={errSesiones}
                cerrandoOtras={cerrandoOtras}
                onCerrarOtras={async () => {
                  setCerrandoOtras(true)
                  const { error } = await supabase.auth.signOut({ scope: 'others' })
                  setCerrandoOtras(false)
                  if (error) {
                    setErrSesiones(error.message)
                  } else {
                    void logAuditAction(
                      { accion: 'cerrar_sesiones', entidad: 'usuarios', entidadId: profile!.id },
                      profile!.id,
                    )
                    setToast('Otras sesiones cerradas correctamente.')
                    setTimeout(() => setToast(null), 3500)
                    void cargarSesiones()
                  }
                }}
              />
            )}

            {/* HU-PAGO-02 — Panel de tarjetas tokenizadas (solo residentes) */}
            {activeTab === 'tarjetas' && profile.rol === 'residente' && (
              <MisTarjetas />
            )}
          </div>
        </div>

        {toast && (
          <div
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-success text-white px-5 py-3 rounded-full shadow-lg text-sm font-medium animate-fade-in"
            role="status"
          >
            ✓ {toast}
          </div>
        )}
      </main>
    </div>
  )
}

function ReadonlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 py-1">
      <span className="text-xs sm:text-sm text-warm-400">{label}</span>
      <span className="text-sm font-medium text-primary-900 sm:text-right truncate">{value}</span>
    </div>
  )
}

// ─── SesionePanel ─────────────────────────────────────────────────────────────
// PBI-S6-E03 — Pestaña de sesiones activas del perfil.
// Muestra la sesión actual (única expuesta por el SDK de cliente Supabase)
// y permite cerrar todas las demás sesiones en otros dispositivos.

type SesionInfo = {
  id: string
  user_agent: string
  created_at: string
  ip_address: string | null
  es_actual: boolean
}

function parseDispositivo(ua: string): { dispositivo: string; navegador: string } {
  const ua_lower = ua.toLowerCase()

  // Sistema operativo
  let dispositivo = 'Escritorio'
  if (/iphone/.test(ua_lower))         dispositivo = 'iPhone'
  else if (/ipad/.test(ua_lower))      dispositivo = 'iPad'
  else if (/android/.test(ua_lower))   dispositivo = ua_lower.includes('mobile') ? 'Android (Móvil)' : 'Android (Tablet)'
  else if (/mac os x/.test(ua_lower))  dispositivo = 'Mac'
  else if (/windows/.test(ua_lower))   dispositivo = 'Windows'
  else if (/linux/.test(ua_lower))     dispositivo = 'Linux'

  // Navegador
  let navegador = 'Navegador desconocido'
  if (/edg\//.test(ua_lower))          navegador = 'Edge'
  else if (/opr\//.test(ua_lower))     navegador = 'Opera'
  else if (/chrome\//.test(ua_lower))  navegador = 'Chrome'
  else if (/firefox\//.test(ua_lower)) navegador = 'Firefox'
  else if (/safari\//.test(ua_lower))  navegador = 'Safari'

  return { dispositivo, navegador }
}

function formatearFechaSesion(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function SesionePanel({
  sesiones,
  cargando,
  error,
  cerrandoOtras,
  onCerrarOtras,
}: {
  sesiones: SesionInfo[]
  cargando: boolean
  error: string | null
  cerrandoOtras: boolean
  onCerrarOtras: () => void
}) {
  return (
    <div className="animate-fade-in space-y-6">
      {/* Cabecera informativa */}
      <div className="rounded-xl bg-primary-50 border border-primary-100 p-4 flex items-start gap-3">
        <svg className="w-5 h-5 text-primary-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <div>
          <p className="text-sm font-medium text-primary-900">Sesiones activas</p>
          <p className="text-xs text-primary-700 mt-0.5">
            Gestiona los dispositivos con acceso a tu cuenta. Si reconoces actividad sospechosa, cierra las demás sesiones inmediatamente.
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm">
          {error}
        </div>
      )}

      {/* Skeleton */}
      {cargando && (
        <div className="animate-pulse space-y-3">
          {[1].map(i => (
            <div key={i} className="rounded-xl border border-warm-200 p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-warm-100 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-40 bg-warm-100 rounded" />
                <div className="h-3 w-56 bg-warm-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lista de sesiones */}
      {!cargando && sesiones.length === 0 && !error && (
        <p className="text-sm text-warm-400 text-center py-4">
          No hay información de sesiones disponible.
        </p>
      )}

      {!cargando && sesiones.length > 0 && (
        <ul className="space-y-3">
          {sesiones.map(s => {
            const { dispositivo, navegador } = parseDispositivo(s.user_agent)
            return (
              <li
                key={s.id}
                className="rounded-xl border border-warm-200 p-4 flex items-start gap-4"
              >
                {/* Icono dispositivo */}
                <div className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center shrink-0">
                  {dispositivo.includes('iPhone') || dispositivo.includes('Android') || dispositivo.includes('iPad') ? (
                    <svg className="w-5 h-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  )}
                </div>

                {/* Detalles */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-primary-900">
                      {dispositivo} · {navegador}
                    </p>
                    {s.es_actual && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6rem] font-semibold bg-primary-100 text-primary-700 border border-primary-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" aria-hidden="true" />
                        Esta sesión
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-warm-400 mt-0.5">
                    Inicio: {formatearFechaSesion(s.created_at)}
                  </p>
                  <p className="text-[0.625rem] text-warm-300 mt-1 truncate" title={s.user_agent}>
                    {s.user_agent}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* Zona de acción */}
      <div className="rounded-xl border border-warm-200 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-primary-900">Cerrar todas las demás sesiones</p>
          <p className="text-xs text-warm-400 mt-0.5">
            Invalida el acceso en todos los dispositivos excepto este. Tu sesión actual no se ve afectada.
          </p>
        </div>
        <button
          type="button"
          onClick={onCerrarOtras}
          disabled={cerrandoOtras}
          className="h-10 px-4 rounded-lg bg-error text-white text-sm font-medium hover:bg-error/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shrink-0"
        >
          {cerrandoOtras ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          )}
          Cerrar las demás
        </button>
      </div>

      {/* Nota sobre cambio de contraseña */}
      <p className="text-xs text-warm-400 flex items-start gap-1.5">
        <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Al cambiar tu contraseña (pestaña Seguridad) se cierran automáticamente todas las demás sesiones.
      </p>
    </div>
  )
}
