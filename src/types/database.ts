export type Rol = 'residente' | 'admin' | 'tecnico'
export type EstadoCuenta = 'pendiente' | 'activo' | 'bloqueado'
export type EstadoInvitacion = 'pendiente' | 'aceptada' | 'expirada'
export type EstadoSolicitud = 'pendiente' | 'asignada' | 'en_progreso' | 'resuelta' | 'cerrada'
export type TipoSolicitud = 'mantenimiento' | 'reparacion' | 'queja' | 'sugerencia' | 'otro'
export type CategoriaSolicitud = 'plomeria' | 'electricidad' | 'limpieza' | 'seguridad' | 'areas_comunes' | 'otro'
export type TipoNotificacion = 'estado_cambio' | 'asignacion' | 'nueva_solicitud' | 'sistema' | 'alerta_rechazo' | 'factura_nueva'

export type Profile = {
  id: string
  email: string
  nombre: string
  apellido: string
  telefono: string
  rol: Rol
  piso: string
  departamento: string
  estado_cuenta: EstadoCuenta
  empresa_tercero: string | null
  created_at: string
  updated_at: string
}

export type Invitacion = {
  id: string
  email: string
  rol: Rol
  nombre: string | null
  piso: string | null
  departamento: string | null
  token: string
  estado: EstadoInvitacion
  creada_por: string | null
  expires_at: string
  created_at: string
}

export type Edificio = {
  id: string
  nombre: string
  direccion: string
  pisos: number
  unidades_por_piso: number
  created_at: string
}

export type Unidad = {
  id: string
  edificio_id: string
  numero: string
  piso: number
  descripcion: string
  created_at: string
}

export type Solicitud = {
  id: string
  codigo: string | null
  residente_id: string
  unidad_id: string | null
  tipo: TipoSolicitud
  categoria: CategoriaSolicitud
  descripcion: string
  estado: EstadoSolicitud
  prioridad: string
  imagen_url: string | null
  piso: string | null
  departamento: string | null
  // HU-MANT-07 SPRINT-4 — Confirmación del residente y contador de rechazos
  // Opcionales hasta que el admin ejecute la migración SQL en Supabase
  confirmada_por_residente?: boolean
  intentos_resolucion?: number
  created_at: string
  updated_at: string
}

export type Asignacion = {
  id: string
  solicitud_id: string
  tecnico_id: string
  asignado_por: string
  fecha_asignacion: string
  notas: string | null
  empresa_tercero: string | null
}

export type HistorialEstado = {
  id: string
  solicitud_id: string
  estado_anterior: string | null
  estado_nuevo: string
  cambiado_por: string | null
  nota: string | null
  created_at: string
}

export type Notificacion = {
  id: string
  usuario_id: string
  solicitud_id: string | null
  tipo: TipoNotificacion
  titulo: string
  mensaje: string
  leida: boolean
  /** Sprint 8 · HU-FACT-05 — datos extra por tipo (ej: { factura_id: string }). */
  metadata?: Record<string, string> | null
  created_at: string
}

export type AuditLog = {
  id: string
  usuario_id: string | null
  accion: string
  entidad: string | null
  entidad_id: string | null
  resultado: string | null
  created_at: string
}

export type SignUpMetadata = {
  nombre: string
  apellido: string
  telefono: string
  piso: string
  departamento: string
  rol: 'residente' | 'tecnico'
}
