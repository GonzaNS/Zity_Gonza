// Sprint 10 · HU-TIENDA — Tests unitarios de los helpers puros de src/lib/tienda.ts.
//
// Cubre la lógica core del módulo Tienda (DoD v2: cobertura ≥ 60% en src/lib/tienda.ts):
//   • validación de imagen del producto (tipo + peso 2 MB)
//   • clasificación de stock para los badges (agotado / pocas unidades / normal)
//   • path determinístico de la foto + sanitización de nombre
//   • labels de categoría y formateo de precio en soles

import { describe, it, expect } from 'vitest'
import {
  labelCategoria,
  validarImagenProducto,
  pathFotoProducto,
  estadoStock,
  disponibleParaPedir,
  formatearPrecio,
  BADGE_STOCK,
  CATEGORIAS_PRODUCTO,
  LABEL_PRODUCTO_CATEGORIA,
  STOCK_BAJO_UMBRAL,
  PRODUCTO_IMAGEN_MAX_BYTES,
  BUCKET_PRODUCTOS,
  BUSQUEDA_DEBOUNCE_MS,
  CATALOGO_PAGE_SIZE,
  type ProductoCategoria,
} from '../../lib/tienda'

// Helper: crea un File del tamaño y tipo indicados (jsdom soporta File).
function fakeFile(bytes: number, type: string, name = 'foto.jpg'): File {
  return new File([new ArrayBuffer(bytes)], name, { type })
}

describe('labelCategoria / catálogo de categorías', () => {
  it('traduce cada categoría a su etiqueta legible', () => {
    expect(labelCategoria('bebidas')).toBe('Bebidas')
    expect(labelCategoria('comestibles')).toBe('Comestibles')
    expect(labelCategoria('limpieza')).toBe('Limpieza')
    expect(labelCategoria('otros')).toBe('Otros')
  })

  it('CATEGORIAS_PRODUCTO y LABEL_PRODUCTO_CATEGORIA están alineados', () => {
    expect(CATEGORIAS_PRODUCTO).toHaveLength(4)
    for (const { value, label } of CATEGORIAS_PRODUCTO) {
      expect(LABEL_PRODUCTO_CATEGORIA[value]).toBe(label)
    }
  })

  it('devuelve el valor crudo si la categoría no está mapeada (defensivo)', () => {
    expect(labelCategoria('inexistente' as ProductoCategoria)).toBe('inexistente')
  })
})

describe('validarImagenProducto', () => {
  it('acepta JPEG/PNG dentro del límite de 2 MB', () => {
    expect(validarImagenProducto(fakeFile(1024, 'image/jpeg'))).toEqual({ ok: true })
    expect(validarImagenProducto(fakeFile(1024, 'image/png'))).toEqual({ ok: true })
  })

  it('rechaza un tipo no permitido', () => {
    const r = validarImagenProducto(fakeFile(1024, 'image/gif'))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.mensaje).toMatch(/JPEG o PNG/)
  })

  it('rechaza una imagen que supera 2 MB e informa el peso', () => {
    const r = validarImagenProducto(fakeFile(PRODUCTO_IMAGEN_MAX_BYTES + 1, 'image/jpeg'))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.mensaje).toMatch(/2 MB/)
  })

  it('acepta exactamente el límite (2 MB)', () => {
    expect(validarImagenProducto(fakeFile(PRODUCTO_IMAGEN_MAX_BYTES, 'image/png'))).toEqual({ ok: true })
  })
})

describe('pathFotoProducto', () => {
  it('genera {producto_id}/{timestamp}_{nombre_seguro}', () => {
    const path = pathFotoProducto('prod-123', fakeFile(10, 'image/jpeg', 'Agua Sin Gas.JPG'))
    expect(path).toMatch(/^prod-123\/\d+_agua-sin-gas\.jpg$/)
  })

  it('sanitiza caracteres especiales y acentos del nombre', () => {
    const path = pathFotoProducto('p1', fakeFile(10, 'image/png', 'Té & Café #2.png'))
    // Los caracteres no [a-z0-9.] colapsan en guiones simples
    expect(path).toMatch(/^p1\/\d+_t-caf-2\.png$/)
  })

  it('usa "foto" como fallback si el nombre queda vacío tras sanitizar', () => {
    const path = pathFotoProducto('p1', fakeFile(10, 'image/png', '@@@'))
    expect(path).toMatch(/^p1\/\d+_foto$/)
  })
})

describe('estadoStock', () => {
  it('clasifica como agotado cuando stock = 0 (o negativo defensivo)', () => {
    expect(estadoStock(0)).toBe('agotado')
    expect(estadoStock(-3)).toBe('agotado')
  })

  it('clasifica como bajo cuando 1 ≤ stock ≤ umbral (5)', () => {
    expect(estadoStock(1)).toBe('bajo')
    expect(estadoStock(STOCK_BAJO_UMBRAL)).toBe('bajo')
  })

  it('clasifica como disponible cuando stock > umbral', () => {
    expect(estadoStock(STOCK_BAJO_UMBRAL + 1)).toBe('disponible')
    expect(estadoStock(24)).toBe('disponible')
  })

  it('cada estado con badge tiene label y clases', () => {
    expect(BADGE_STOCK.bajo.label).toBe('Pocas unidades')
    expect(BADGE_STOCK.agotado.label).toBe('Agotado')
    expect(BADGE_STOCK.bajo.clases).toContain('accent')
    expect(BADGE_STOCK.agotado.clases).toContain('warm')
  })
})

describe('disponibleParaPedir', () => {
  it('true solo si está activo y con stock', () => {
    expect(disponibleParaPedir({ activo: true, stock: 3 })).toBe(true)
  })
  it('false si está agotado', () => {
    expect(disponibleParaPedir({ activo: true, stock: 0 })).toBe(false)
  })
  it('false si está inactivo aunque tenga stock', () => {
    expect(disponibleParaPedir({ activo: false, stock: 10 })).toBe(false)
  })
})

describe('formatearPrecio', () => {
  it('formatea en soles con 2 decimales', () => {
    const s = formatearPrecio(1500.5)
    expect(s).toContain('500')
    expect(s).toMatch(/[.,]\d{2}$/) // termina en 2 decimales
  })
  it('formatea el cero', () => {
    expect(formatearPrecio(0)).toMatch(/0[.,]00$/)
  })
})

describe('constantes de UI del Sprint 10', () => {
  it('expone los valores documentados en conventions.md', () => {
    expect(STOCK_BAJO_UMBRAL).toBe(5)
    expect(BUSQUEDA_DEBOUNCE_MS).toBe(300)
    expect(CATALOGO_PAGE_SIZE).toBe(24)
    expect(PRODUCTO_IMAGEN_MAX_BYTES).toBe(2 * 1024 * 1024)
    expect(BUCKET_PRODUCTOS).toBe('productos-fotos')
  })
})
