// Sprint 12 · HU-ANUNCIO-02/03 · Chore OWASP A03 — Render seguro de markdown.
//
// El cuerpo de un anuncio es contenido publicado que ven TODOS los residentes,
// así que se renderiza con react-markdown endurecido (defensa en profundidad, la
// 1ª capa es la sanitización en servidor — trigger before_anuncio_sanitizar):
//   • skipHtml + sin rehype-raw → el HTML crudo NUNCA se interpreta.
//   • allowedElements → solo un subconjunto "markdown limitado" (negrita, cursiva,
//     enlaces, listas, citas, código, h3/h4). Las imágenes embebidas se descartan.
//   • urlTransform por defecto (defaultUrlTransform) → bloquea javascript:/data:.
//   • Los enlaces se abren en pestaña nueva con rel="noopener noreferrer nofollow".

import Markdown, { type Components } from 'react-markdown'

/** Subconjunto permitido. Cualquier otro elemento se descarta (se conserva su texto). */
const ELEMENTOS_PERMITIDOS = [
  'p', 'br', 'strong', 'em', 'del', 'code', 'blockquote',
  'ul', 'ol', 'li', 'a', 'h3', 'h4',
]

const COMPONENTES: Components = {
  p:   ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-primary-900">{children}</strong>,
  em:  ({ children }) => <em className="italic">{children}</em>,
  del: ({ children }) => <del className="line-through opacity-70">{children}</del>,
  a:   ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="text-primary-700 underline underline-offset-2 hover:text-primary-900 break-words"
    >
      {children}
    </a>
  ),
  ul:  ({ children }) => <ul className="mb-3 last:mb-0 list-disc pl-5 space-y-1">{children}</ul>,
  ol:  ({ children }) => <ol className="mb-3 last:mb-0 list-decimal pl-5 space-y-1">{children}</ol>,
  li:  ({ children }) => <li className="leading-relaxed">{children}</li>,
  h3:  ({ children }) => <h3 className="font-display text-lg font-semibold text-primary-900 mt-4 mb-2 first:mt-0">{children}</h3>,
  h4:  ({ children }) => <h4 className="font-semibold text-primary-800 mt-3 mb-1.5 first:mt-0">{children}</h4>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-primary-200 pl-3 italic text-warm-500 my-3">{children}</blockquote>
  ),
  code: ({ children }) => (
    <code className="bg-warm-100 text-primary-800 rounded px-1 py-0.5 text-[0.85em] font-mono">{children}</code>
  ),
}

type Props = {
  /** Texto markdown (ya sanitizado en servidor; aquí se renderiza de forma segura). */
  children: string
  className?: string
}

export default function MarkdownSeguro({ children, className }: Props) {
  return (
    <div className={className}>
      <Markdown
        skipHtml
        allowedElements={ELEMENTOS_PERMITIDOS}
        unwrapDisallowed
        components={COMPONENTES}
      >
        {children}
      </Markdown>
    </div>
  )
}
