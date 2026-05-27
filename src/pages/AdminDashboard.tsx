import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import AdminShell from '../components/admin/AdminShell'
import PopoverExportarCSV from '../components/admin/PopoverExportarCSV'
import { supabase } from '../lib/supabase'

type StatKey = 'pendientes' | 'en_progreso' | 'resueltas_mes'

type StatCard = {
  key: StatKey
  label: string
  accent: 'primary' | 'accent' | 'success'
  icon: React.ReactNode
}

const STAT_CARDS: StatCard[] = [
  {
    key: 'pendientes',
    label: 'Solicitudes pendientes',
    accent: 'accent',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    key: 'en_progreso',
    label: 'En progreso',
    accent: 'primary',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    key: 'resueltas_mes',
    label: 'Resueltas este mes',
    accent: 'success',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
]

const ACCENT_STYLES: Record<StatCard['accent'], string> = {
  primary: 'bg-primary-50 text-primary-700',
  accent: 'bg-accent-50 text-accent-700',
  success: 'bg-green-50 text-success',
}

export default function AdminDashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState<Record<StatKey, number | null>>({
    pendientes: null,
    en_progreso: null,
    resueltas_mes: null,
  })

  useEffect(() => {
    let cancelado = false
    async function cargar() {
      // Tres queries `head: true` con `count: 'exact'` traen sólo el COUNT,
      // sin filas. Las disparamos en paralelo.
      const inicioMes = new Date()
      inicioMes.setDate(1)
      inicioMes.setHours(0, 0, 0, 0)

      const [pendientes, enProgreso, resueltasMes] = await Promise.all([
        supabase.from('solicitudes').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente'),
        supabase.from('solicitudes').select('id', { count: 'exact', head: true }).eq('estado', 'en_progreso'),
        supabase
          .from('solicitudes')
          .select('id', { count: 'exact', head: true })
          .eq('estado', 'resuelta')
          .gte('updated_at', inicioMes.toISOString()),
      ])

      if (cancelado) return
      setStats({
        pendientes: pendientes.count ?? 0,
        en_progreso: enProgreso.count ?? 0,
        resueltas_mes: resueltasMes.count ?? 0,
      })
    }
    cargar()
    return () => {
      cancelado = true
    }
  }, [])

  return (
    <AdminShell
      title="Panel de administración"
      subtitle={`Bienvenido, ${profile?.nombre ?? 'admin'}. Aquí gestionas el edificio.`}
      actions={<PopoverExportarCSV />}
    >
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 animate-fade-in delay-1">
        {STAT_CARDS.map(card => {
          const valor = stats[card.key]
          return (
            <div key={card.label} className="bg-white rounded-xl border border-warm-200 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3 mb-3">
                <p className="text-sm text-warm-400 leading-tight">{card.label}</p>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${ACCENT_STYLES[card.accent]}`}>
                  {card.icon}
                </div>
              </div>
              <p className="font-display text-3xl font-semibold text-primary-900 leading-none">
                {valor === null ? '—' : valor}
              </p>
              <p className="mt-1.5 text-xs text-warm-400">
                {valor === null
                  ? 'Cargando…'
                  : card.key === 'resueltas_mes'
                    ? 'Mes actual'
                    : 'Hoy'}
              </p>
            </div>
          )
        })}
      </div>

      {/* Quick actions */}
      <div className="mt-6 sm:mt-8">
        <h2 className="font-display text-lg sm:text-xl font-semibold text-primary-900 mb-4 animate-fade-in delay-2">
          Accesos rápidos
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in delay-3">
          <Link
            to="/admin/usuarios"
            className="group bg-white rounded-xl border border-warm-200 p-5 sm:p-6 hover:border-primary-300 hover:shadow-sm transition-all cursor-pointer"
          >
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="w-11 h-11 rounded-lg bg-primary-50 flex items-center justify-center group-hover:bg-primary-100 transition-colors shrink-0">
                <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-primary-900 mb-1">Gestión de usuarios</h3>
                <p className="text-sm text-warm-400 leading-relaxed">
                  Ver, filtrar, invitar y bloquear usuarios del edificio.
                </p>
              </div>
              <svg className="w-5 h-5 text-warm-400 group-hover:text-primary-600 transition-colors shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          <Link
            to="/admin/solicitudes"
            className="group bg-white rounded-xl border border-warm-200 p-5 sm:p-6 hover:border-primary-300 hover:shadow-sm transition-all cursor-pointer"
          >
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="w-11 h-11 rounded-lg bg-accent-50 flex items-center justify-center group-hover:bg-accent-100 transition-colors shrink-0">
                <svg className="w-5 h-5 text-accent-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-primary-900 mb-1">Solicitudes de mantenimiento</h3>
                <p className="text-sm text-warm-400 leading-relaxed">
                  Revisa solicitudes pendientes con foto y detalles del residente.
                </p>
              </div>
              <svg className="w-5 h-5 text-warm-400 group-hover:text-primary-600 transition-colors shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        </div>
      </div>
    </AdminShell>
  )
}
