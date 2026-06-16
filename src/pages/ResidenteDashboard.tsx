// Sprint 13 · HU-HOME-01/02/03/04 — Dashboard integral del residente.
// Ruta: /residente
//
// Tarjetas:
//   • Solicitudes activas (HU-HOME-02) → CardHomeSolicitudes
//   • Facturas pendientes (HU-HOME-03) → CardHomeFacturas
//   • Pedidos del mes    (HU-HOME-04) → CardHomePedidos
//
// Layout responsive: 1 col móvil ≤640px · 3 col desktop

import { useAuth } from '../contexts/AuthContext'
import CardHomeSolicitudes from '../components/residente/CardHomeSolicitudes'
import CardHomeFacturas from '../components/residente/CardHomeFacturas'
import CardHomePedidos from '../components/residente/CardHomePedidos'
import ResidenteHeader from '../components/residente/ResidenteHeader'

export default function ResidenteDashboard() {
  const { profile } = useAuth()
  return (
    <div className="min-h-screen bg-warm-50">
      <ResidenteHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {/* ── Saludo ── */}
        <div className="animate-fade-in mb-8 sm:mb-10">
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-primary-900 tracking-tight">
            Hola, {profile?.nombre} 👋
          </h1>
          <p className="mt-1 text-warm-400 text-sm">
            {profile?.piso && profile?.departamento
              ? `Piso ${profile.piso}, Depto. ${profile.departamento} · Aquí tienes tu estado de un vistazo.`
              : 'Tu unidad aún no está configurada.'}
          </p>
        </div>

        {/* ── Grid de 3 tarjetas ── */}
        {/* R2: desktop = 3 columnas, móvil (≤ 640 px) = 1 columna apiladas */}
        <section aria-label="Mi estado de un vistazo">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6">
            {/* Tarjeta 1 — Solicitudes activas (HU-HOME-02) */}
            <div className="animate-fade-in delay-1">
              <CardHomeSolicitudes />
            </div>

            {/* Tarjeta 2 — Facturas pendientes (HU-HOME-03) */}
            <div className="animate-fade-in delay-2">
              <CardHomeFacturas />
            </div>

            {/* Tarjeta 3 — Pedidos del mes (HU-HOME-04) */}
            <div className="animate-fade-in delay-3">
              <CardHomePedidos />
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
