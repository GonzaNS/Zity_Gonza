// Sprint 12 · HU-ANUNCIO — Tests unitarios de los helpers puros de src/lib/anuncios.ts.
//
// Cubre la lógica core del módulo Comunicación (DoD v3: cobertura ≥ 60%):
//   • validación del adjunto (JPEG/PNG/PDF + peso 2 MB)
//   • path determinístico del adjunto + detección de PDF
//   • vigencia (no archivado + no vencido) y orden del feed (fijados arriba)
//   • extracto en texto plano del cuerpo markdown
//   • filtro por categoría y labels/badges

import { describe, it, expect } from 'vitest'
import {
  labelCategoria,
  labelPrioridad,
  validarAdjunto,
  pathAdjuntoAnuncio,
  esPdf,
  extracto,
  estaVigente,
  ordenarFeed,
  filtrarPorCategoria,
  CATEGORIAS_ANUNCIO,
  LABEL_ANUNCIO_CATEGORIA,
  PRIORIDADES_ANUNCIO,
  BADGE_CATEGORIA,
  BADGE_PRIORIDAD,
  ANUNCIO_ADJUNTO_MAX_BYTES,
  ANUNCIO_ADJUNTO_MIME_PERMITIDOS,
  BUCKET_ANUNCIOS,
  type AnuncioCategoria,
  type Anuncio,
} from '../../lib/anuncios'

function fakeFile(bytes: number, type: string, name = 'foto.jpg'): File {
  return new File([new ArrayBuffer(bytes)], name, { type })
}

function anuncio(parcial: Partial<Anuncio>): Anuncio {
  return {
    id: 'a1', titulo: 'T', cuerpo: 'C', categoria: 'general', prioridad: 'normal',
    imagen_url: null, fijado: false, vigente_hasta: null, archivado: false,
    publicado_por: null, created_at: '2026-06-01T10:00:00Z', updated_at: '2026-06-01T10:00:00Z',
    ...parcial,
  }
}

describe('labels y catálogos', () => {
  it('traduce categorías y prioridades a etiquetas legibles', () => {
    expect(labelCategoria('mantenimiento')).toBe('Mantenimiento')
    expect(labelCategoria('asamblea')).toBe('Asamblea')
    expect(labelPrioridad('urgente')).toBe('Urgente')
    expect(labelPrioridad('normal')).toBe('Normal')
  })

  it('CATEGORIAS_ANUNCIO y LABEL_ANUNCIO_CATEGORIA están alineados (5 categorías)', () => {
    expect(CATEGORIAS_ANUNCIO).toHaveLength(5)
    for (const { value, label } of CATEGORIAS_ANUNCIO) {
      expect(LABEL_ANUNCIO_CATEGORIA[value]).toBe(label)
    }
  })

  it('expone 3 prioridades y un color de badge por categoría', () => {
    expect(PRIORIDADES_ANUNCIO).toHaveLength(3)
    for (const { value } of CATEGORIAS_ANUNCIO) {
      expect(BADGE_CATEGORIA[value]).toBeTruthy()
    }
  })

  it('normal no lleva badge de prioridad; importante y urgente sí', () => {
    expect(BADGE_PRIORIDAD.normal).toBeNull()
    expect(BADGE_PRIORIDAD.importante?.label).toBe('Importante')
    expect(BADGE_PRIORIDAD.urgente?.clases).toContain('error')
  })

  it('devuelve el valor crudo si la categoría no está mapeada (defensivo)', () => {
    expect(labelCategoria('inexistente' as AnuncioCategoria)).toBe('inexistente')
  })
})

describe('validarAdjunto', () => {
  it('acepta JPEG, PNG y PDF dentro del límite de 2 MB', () => {
    expect(validarAdjunto(fakeFile(1024, 'image/jpeg'))).toEqual({ ok: true })
    expect(validarAdjunto(fakeFile(1024, 'image/png'))).toEqual({ ok: true })
    expect(validarAdjunto(fakeFile(1024, 'application/pdf', 'acta.pdf'))).toEqual({ ok: true })
  })

  it('rechaza un tipo no permitido', () => {
    const r = validarAdjunto(fakeFile(1024, 'image/gif'))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.mensaje).toMatch(/JPEG, PNG o PDF/)
  })

  it('rechaza un archivo que supera 2 MB e informa el peso', () => {
    const r = validarAdjunto(fakeFile(ANUNCIO_ADJUNTO_MAX_BYTES + 1, 'application/pdf', 'x.pdf'))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.mensaje).toMatch(/2 MB/)
  })

  it('acepta exactamente el límite (2 MB)', () => {
    expect(validarAdjunto(fakeFile(ANUNCIO_ADJUNTO_MAX_BYTES, 'image/png'))).toEqual({ ok: true })
  })

  it('expone las constantes del bucket', () => {
    expect(BUCKET_ANUNCIOS).toBe('anuncios-adjuntos')
    expect(ANUNCIO_ADJUNTO_MIME_PERMITIDOS).toContain('application/pdf')
    expect(ANUNCIO_ADJUNTO_MAX_BYTES).toBe(2 * 1024 * 1024)
  })
})

describe('pathAdjuntoAnuncio / esPdf', () => {
  it('genera {anuncio_id}/{timestamp}_{nombre_seguro}.ext', () => {
    const path = pathAdjuntoAnuncio('an-123', fakeFile(10, 'image/jpeg', 'Corte de Agua.JPG'))
    expect(path).toMatch(/^an-123\/\d+_corte-de-agua\.jpg$/)
  })

  it('sanitiza acentos y símbolos del nombre conservando la extensión', () => {
    const path = pathAdjuntoAnuncio('a1', fakeFile(10, 'application/pdf', 'Acta Asamblea #2 (Té).pdf'))
    expect(path).toMatch(/^a1\/\d+_acta-asamblea-2-t\.pdf$/)
  })

  it('usa "adjunto" como fallback si el nombre queda vacío tras sanitizar', () => {
    const path = pathAdjuntoAnuncio('a1', fakeFile(10, 'image/png', '@@@.png'))
    expect(path).toMatch(/^a1\/\d+_adjunto\.png$/)
  })

  it('esPdf detecta solo paths .pdf (case-insensitive)', () => {
    expect(esPdf('a1/123_acta.pdf')).toBe(true)
    expect(esPdf('a1/123_acta.PDF')).toBe(true)
    expect(esPdf('a1/123_foto.jpg')).toBe(false)
    expect(esPdf(null)).toBe(false)
    expect(esPdf(undefined)).toBe(false)
  })
})

describe('estaVigente', () => {
  const HOY = '2026-06-15'

  it('vigente si no está archivado y no tiene caducidad', () => {
    expect(estaVigente(anuncio({ vigente_hasta: null, archivado: false }), HOY)).toBe(true)
  })

  it('no vigente si está archivado (aunque no haya vencido)', () => {
    expect(estaVigente(anuncio({ vigente_hasta: '2026-12-31', archivado: true }), HOY)).toBe(false)
  })

  it('vigente si vigente_hasta es hoy o futuro', () => {
    expect(estaVigente(anuncio({ vigente_hasta: HOY }), HOY)).toBe(true)
    expect(estaVigente(anuncio({ vigente_hasta: '2026-06-20' }), HOY)).toBe(true)
  })

  it('no vigente si vigente_hasta ya pasó', () => {
    expect(estaVigente(anuncio({ vigente_hasta: '2026-06-14' }), HOY)).toBe(false)
  })
})

describe('ordenarFeed', () => {
  it('coloca los fijados arriba y ordena el resto por fecha descendente', () => {
    const items = [
      anuncio({ id: 'viejo', fijado: false, created_at: '2026-06-01T00:00:00Z' }),
      anuncio({ id: 'fijado-viejo', fijado: true, created_at: '2026-05-01T00:00:00Z' }),
      anuncio({ id: 'nuevo', fijado: false, created_at: '2026-06-10T00:00:00Z' }),
      anuncio({ id: 'fijado-nuevo', fijado: true, created_at: '2026-06-09T00:00:00Z' }),
    ]
    const orden = ordenarFeed(items).map(a => a.id)
    expect(orden).toEqual(['fijado-nuevo', 'fijado-viejo', 'nuevo', 'viejo'])
  })

  it('no muta el array original', () => {
    const items = [anuncio({ id: 'a' }), anuncio({ id: 'b' })]
    const copia = [...items]
    ordenarFeed(items)
    expect(items).toEqual(copia)
  })
})

describe('extracto', () => {
  it('quita marcas markdown y colapsa espacios', () => {
    expect(extracto('**Corte** de _agua_ el martes')).toBe('Corte de agua el martes')
  })

  it('convierte enlaces a su texto y descarta imágenes', () => {
    expect(extracto('Ver ![foto](x.jpg) el [portal](https://z.pe) ya')).toBe('Ver el portal ya')
  })

  it('trunca con elipsis cuando supera el máximo', () => {
    const largo = 'a '.repeat(200)
    const r = extracto(largo, 50)
    expect(r.length).toBeLessThanOrEqual(51)
    expect(r.endsWith('…')).toBe(true)
  })
})

describe('filtrarPorCategoria', () => {
  const items = [
    anuncio({ id: 'm', categoria: 'mantenimiento' }),
    anuncio({ id: 's', categoria: 'seguridad' }),
    anuncio({ id: 'm2', categoria: 'mantenimiento' }),
  ]

  it('"todas" no filtra', () => {
    expect(filtrarPorCategoria(items, 'todas')).toHaveLength(3)
  })

  it('filtra por la categoría indicada', () => {
    expect(filtrarPorCategoria(items, 'mantenimiento').map(a => a.id)).toEqual(['m', 'm2'])
    expect(filtrarPorCategoria(items, 'seguridad').map(a => a.id)).toEqual(['s'])
  })
})
