import { Component, ErrorInfo, ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  /** Tipo de visualización del error: 'card' (ideal para widgets/gráficas) o 'inline'. */
  variant?: 'card' | 'inline'
  /** Mensaje amigable alternativo. */
  message?: string
  /** Título alternativo para el error. */
  title?: string
  /** Callback opcional al recuperarse / reintentar. */
  onReset?: () => void
  /** Permite inyectar un error externo (como errores de API de base de datos) de forma declarativa. */
  externalError?: string | null
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  isExternal: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
    isExternal: false,
  }

  public static getDerivedStateFromProps(
    nextProps: ErrorBoundaryProps,
    state: ErrorBoundaryState
  ): Partial<ErrorBoundaryState> | null {
    if (nextProps.externalError) {
      // Si hay un error externo nuevo o diferente al actual
      if (!state.hasError || !state.isExternal || state.error?.message !== nextProps.externalError) {
        return {
          hasError: true,
          error: new Error(nextProps.externalError),
          errorInfo: null,
          isExternal: true,
        }
      }
    } else if (state.isExternal && state.hasError) {
      // Si el error era externo pero el error externo ya se limpió (ej. al refrescar con éxito), recuperarse
      return {
        hasError: false,
        error: null,
        errorInfo: null,
        isExternal: false,
      }
    }
    return null
  }

  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error, isExternal: false }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo })
    // Logs controlados en la consola del navegador para depuración.
    console.error('[ErrorBoundary caught an error]:', error, errorInfo)
  }

  private handleReset = () => {
    if (this.props.onReset) {
      this.props.onReset()
    }
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      isExternal: false,
    })
  }

  public render() {
    if (this.state.hasError) {
      const { variant = 'card', title = 'No se pudo cargar este elemento', message } = this.props
      const errorDetail = this.state.error?.message || 'Error desconocido de renderizado.'

      if (variant === 'inline') {
        return (
          <div className="p-3 rounded-lg bg-error/10 border border-error/20 text-error text-xs flex flex-col gap-1.5 animate-fade-in">
            <div className="flex items-center justify-between font-semibold">
              <span>{title}</span>
              <button
                type="button"
                onClick={this.handleReset}
                className="px-2 py-0.5 rounded bg-error/20 hover:bg-error/30 transition-colors text-[0.65rem] font-bold uppercase cursor-pointer"
              >
                Reintentar
              </button>
            </div>
            <p className="opacity-90">{message || errorDetail}</p>
          </div>
        )
      }

      // Variante 'card' (ideal para envolver componentes como gráficos o widgets grandes)
      return (
        <div className="bg-white border border-warm-200 rounded-xl p-5 sm:p-6 flex flex-col justify-between min-h-[220px] shadow-sm hover:shadow transition-shadow animate-fade-in">
          <div>
            <div className="flex items-center gap-2.5 text-error mb-2">
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="text-sm font-semibold text-primary-900">{title}</h3>
            </div>

            <p className="text-xs text-warm-400 leading-relaxed mb-4">
              {message || 'Se produjo un error al renderizar o procesar los datos de este componente. Es posible que falten dependencias o que la base de datos no esté sincronizada.'}
            </p>

            {/* Detalles técnicos auto-plegables */}
            <details className="group border border-warm-100 rounded-lg overflow-hidden bg-warm-50/50 mb-4 transition-all">
              <summary className="px-3 py-1.5 text-[0.7rem] font-medium text-warm-400 hover:text-primary-700 cursor-pointer list-none flex items-center justify-between select-none">
                <span>Ver detalles técnicos</span>
                <svg className="w-3.5 h-3.5 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="px-3 pb-3 pt-1 border-t border-warm-100 text-[0.65rem] font-mono text-error/90 overflow-x-auto max-h-[120px] whitespace-pre-wrap leading-normal">
                <p className="font-bold mb-1">Exception: {this.state.error?.name}</p>
                <p className="mb-2">{errorDetail}</p>
                {this.state.errorInfo?.componentStack && (
                  <p className="text-warm-400 opacity-80 leading-snug">
                    {this.state.errorInfo.componentStack.trim()}
                  </p>
                )}
              </div>
            </details>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={this.handleReset}
              className="h-8 px-4 flex items-center justify-center text-xs font-semibold text-primary-700 border border-warm-200 rounded-lg hover:bg-warm-50 transition-all cursor-pointer shadow-sm active:scale-95"
            >
              Reintentar
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
