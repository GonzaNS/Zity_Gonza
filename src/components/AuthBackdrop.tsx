/**
 * AuthBackdrop — fondo difuminado de las pantallas de autenticación.
 *
 * Un degradado teal (color del sistema) con manchas difuminadas que aportan
 * profundidad y una viñeta que oscurece los bordes para que la tarjeta blanca
 * gane protagonismo. Sin figuras ni líneas: minimalista y profesional.
 *
 * Decorativo (aria-hidden) y sin captura de eventos.
 */
export default function AuthBackdrop() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Base teal suave */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(155deg, #e7f1f4 0%, #c3dae1 45%, #9cc2cf 100%)' }}
      />

      {/* Manchas difuminadas (mesh) con deriva lentísima */}
      <div
        className="aurora-a absolute -top-[20%] -left-[14%] h-[62vmax] w-[62vmax] rounded-full blur-[110px] opacity-70"
        style={{ background: 'radial-gradient(circle, rgba(27,58,75,0.30) 0%, transparent 62%)' }}
      />
      <div
        className="aurora-b absolute -bottom-[24%] -right-[14%] h-[60vmax] w-[60vmax] rounded-full blur-[120px] opacity-75"
        style={{ background: 'radial-gradient(circle, rgba(61,122,146,0.42) 0%, transparent 62%)' }}
      />
      {/* Toque dorado de marca, apenas perceptible */}
      <div
        className="absolute top-[14%] right-[8%] h-[40vmax] w-[40vmax] rounded-full blur-[130px] opacity-45"
        style={{ background: 'radial-gradient(circle, rgba(212,160,67,0.22) 0%, transparent 64%)' }}
      />

      {/* Viñeta: enmarca y da protagonismo a la tarjeta */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(120% 95% at 50% 42%, transparent 46%, rgba(8,18,24,0.30) 100%)' }}
      />
    </div>
  )
}
