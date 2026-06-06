// Sprint 11 · HU-TIENDA-03 — Estado global del carrito del residente.
//
// Carga el pedido 'borrador' del residente y expone sus líneas, unidades y total
// (calculados en el servidor), más las acciones de mutación (agregar/cambiar/quitar/
// confirmar) que pasan por las RPCs. También gobierna la apertura del drawer del
// carrito, para que el mini-carrito de cualquier header del residente lo abra.
//
// Se monta global (como NotificacionesProvider) pero solo carga si el rol es
// 'residente'; para admin/técnico el carrito queda vacío y el mini-carrito no se muestra.

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { useAuth } from './AuthContext'
import {
  obtenerCarrito,
  guardarItemCarrito,
  confirmarPedido,
  type ResultadoConfirmacion,
} from '../lib/carrito'
import { CARRITO_VACIO, clampCantidad, type Carrito } from '../lib/pedidos'

type ResultadoMutacion = { ok: boolean; error?: string }

type CarritoContextType = {
  carrito: Carrito
  unidades: number
  total: number
  esResidente: boolean
  loading: boolean
  guardando: boolean
  drawerAbierto: boolean
  abrirCarrito: () => void
  cerrarCarrito: () => void
  /** Cantidad de un producto en el carrito (0 si no está). */
  cantidadDe: (productoId: string) => number
  /** Fija la cantidad de un producto (acotada a [0, stock]). */
  setCantidad: (productoId: string, cantidad: number, stock: number) => Promise<ResultadoMutacion>
  /** Suma una unidad (respetando el tope de stock). */
  agregarUno: (productoId: string, stock: number) => Promise<ResultadoMutacion>
  /** Quita el producto del carrito. */
  quitar: (productoId: string) => Promise<ResultadoMutacion>
  /** Confirma el pedido (descuento atómico). Vacía el carrito si tiene éxito. */
  confirmar: () => Promise<ResultadoConfirmacion>
  recargar: () => Promise<void>
}

const CarritoContext = createContext<CarritoContextType | null>(null)

export function CarritoProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth()
  const esResidente = profile?.rol === 'residente'
  const usuarioId = esResidente ? user?.id : undefined

  const [carrito, setCarrito] = useState<Carrito>(CARRITO_VACIO)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [drawerAbierto, setDrawerAbierto] = useState(false)

  const cargar = useCallback(async () => {
    if (!usuarioId) {
      setCarrito(CARRITO_VACIO)
      setLoading(false)
      return
    }
    setLoading(true)
    const data = await obtenerCarrito()
    setCarrito(data)
    setLoading(false)
  }, [usuarioId])

  useEffect(() => {
    // Diferimos a un microtask para no hacer setState síncrono en el efecto.
    void Promise.resolve().then(() => cargar())
  }, [cargar])

  const cantidadDe = useCallback(
    (productoId: string) => carrito.items.find((it) => it.producto_id === productoId)?.cantidad ?? 0,
    [carrito.items],
  )

  const setCantidad = useCallback(
    async (productoId: string, cantidad: number, stock: number): Promise<ResultadoMutacion> => {
      const objetivo = cantidad <= 0 ? 0 : clampCantidad(cantidad, stock)
      setGuardando(true)
      const r = await guardarItemCarrito(productoId, objetivo)
      if (r.ok) setCarrito(r.carrito)
      setGuardando(false)
      return r.ok ? { ok: true } : { ok: false, error: r.error }
    },
    [],
  )

  const agregarUno = useCallback(
    (productoId: string, stock: number) => setCantidad(productoId, cantidadDe(productoId) + 1, stock),
    [setCantidad, cantidadDe],
  )

  const quitar = useCallback(
    (productoId: string) => setCantidad(productoId, 0, 0),
    [setCantidad],
  )

  const confirmar = useCallback(async (): Promise<ResultadoConfirmacion> => {
    if (!carrito.pedido_id) return { ok: false, error: 'El carrito está vacío' }
    setGuardando(true)
    const r = await confirmarPedido(carrito.pedido_id)
    if (r.ok) {
      setCarrito(CARRITO_VACIO)
      setDrawerAbierto(false)
    }
    setGuardando(false)
    return r
  }, [carrito.pedido_id])

  const abrirCarrito = useCallback(() => setDrawerAbierto(true), [])
  const cerrarCarrito = useCallback(() => setDrawerAbierto(false), [])

  const value = useMemo<CarritoContextType>(
    () => ({
      carrito,
      unidades: carrito.unidades,
      total: carrito.total,
      esResidente,
      loading,
      guardando,
      drawerAbierto,
      abrirCarrito,
      cerrarCarrito,
      cantidadDe,
      setCantidad,
      agregarUno,
      quitar,
      confirmar,
      recargar: cargar,
    }),
    [carrito, esResidente, loading, guardando, drawerAbierto, abrirCarrito, cerrarCarrito, cantidadDe, setCantidad, agregarUno, quitar, confirmar, cargar],
  )

  return <CarritoContext.Provider value={value}>{children}</CarritoContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCarrito() {
  const ctx = useContext(CarritoContext)
  if (!ctx) throw new Error('useCarrito debe usarse dentro de un CarritoProvider')
  return ctx
}
