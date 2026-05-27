import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { NotificacionesProvider } from './contexts/NotificacionesContext'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthShell } from './components/AuthLayout'
import FullPageSpinner from './components/FullPageSpinner'
import { ROLE_ROUTES } from './lib/routing'

// Code splitting: cada página es un chunk separado que se descarga al navegar
// a su ruta. Reduce el bundle inicial que el visitante anónimo descarga.
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'))
const EmailVerified = lazy(() => import('./pages/EmailVerified'))
const Activar = lazy(() => import('./pages/Activar'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const AdminUsuarios = lazy(() => import('./pages/admin/Usuarios'))
const AdminSolicitudes = lazy(() => import('./pages/admin/Solicitudes'))
const AdminAuditoria = lazy(() => import('./pages/admin/Auditoria'))
const AdminMetricas = lazy(() => import('./pages/admin/Metricas'))     // Sprint 7 · PBI-22
const AdminFacturacion = lazy(() => import('./pages/admin/Facturacion')) // Sprint 8 · HU-FACT-02
const ResidenteDashboard = lazy(() => import('./pages/ResidenteDashboard'))
const ResidenteFacturas = lazy(() => import('./pages/residente/Facturas')) // Sprint 8 · HU-FACT-03
const TecnicoDashboard = lazy(() => import('./pages/TecnicoDashboard'))
const Perfil = lazy(() => import('./pages/Perfil'))
const Notificaciones = lazy(() => import('./pages/Notificaciones'))

function RootRedirect() {
  const { user, profile, loading, isRecovery } = useAuth()

  if (loading) return <FullPageSpinner />
  if (isRecovery) return <Navigate to="/reset-password" replace />
  if (!user) return <Navigate to="/login" replace />

  return <Navigate to={ROLE_ROUTES[profile?.rol ?? 'residente']} replace />
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth()

  if (loading) return <FullPageSpinner />

  if (user && profile?.estado_cuenta === 'activo') {
    return <Navigate to={ROLE_ROUTES[profile.rol]} replace />
  }

  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificacionesProvider>
        <Suspense fallback={<FullPageSpinner />}>
          <Routes>
            {/* Auth routes — AuthShell se mantiene montado entre páginas; solo cambia el Outlet */}
            <Route element={<AuthShell />}>
              <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
              <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
              <Route path="/forgot-password" element={<GuestRoute><ForgotPassword /></GuestRoute>} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/email-verified" element={<EmailVerified />} />
              <Route path="/activar" element={<Activar />} />
            </Route>

            {/* Protected dashboard routes */}
            <Route path="/admin" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            } />
            <Route path="/admin/usuarios" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminUsuarios />
              </ProtectedRoute>
            } />
            <Route path="/admin/solicitudes" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminSolicitudes />
              </ProtectedRoute>
            } />
            {/* Sprint 5 · HU-AUDIT-01 — vista admin del audit_log */}
            <Route path="/admin/auditoria" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminAuditoria />
              </ProtectedRoute>
            } />
            {/* Sprint 7 · PBI-22 — Panel de métricas operativas */}
            <Route path="/admin/metricas" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminMetricas />
              </ProtectedRoute>
            } />
            {/* Sprint 8 · HU-FACT-02 — Emisión de facturas individual y en lote */}
            <Route path="/admin/facturacion" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminFacturacion />
              </ProtectedRoute>
            } />
            <Route path="/residente" element={
              <ProtectedRoute allowedRoles={['residente']}>
                <ResidenteDashboard />
              </ProtectedRoute>
            } />
            {/* Sprint 8 · HU-FACT-03 — Facturas del residente */}
            <Route path="/residente/facturas" element={
              <ProtectedRoute allowedRoles={['residente']}>
                <ResidenteFacturas />
              </ProtectedRoute>
            } />
            <Route path="/tecnico" element={
              <ProtectedRoute allowedRoles={['tecnico']}>
                <TecnicoDashboard />
              </ProtectedRoute>
            } />

            {/* Sprint 5 · PBI-S2-E03 — /perfil accesible para los 3 roles activos */}
            <Route path="/perfil" element={
              <ProtectedRoute allowedRoles={['residente', 'tecnico', 'admin']}>
                <Perfil />
              </ProtectedRoute>
            } />
            <Route path="/notificaciones" element={
              <ProtectedRoute allowedRoles={['residente', 'tecnico', 'admin']}>
                <Notificaciones />
              </ProtectedRoute>
            } />

            {/* Root redirect */}
            <Route path="/" element={<RootRedirect />} />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        </NotificacionesProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
