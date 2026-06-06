/* eslint-disable no-console */
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders, jsonResponse, createServiceClient } from "../_shared/auth.ts"

// Sprint 9 · HU-FACT-08 — Edge Function para el email de recordatorio de vencimiento.
// La invoca la función SQL del cron (marcar_facturas_vencidas_y_recordatorios) vía
// pg_net de forma fire-and-forget, 3 días antes del vencimiento.
//   • Si RESEND_API_KEY está ausente → dry-run (log de consola, responde 200).
//   • Si falla → el cron ya captura la excepción; la notificación in-app (fuente
//     de verdad, Realtime) no se ve afectada.

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) })
  }

  try {
    const { factura_id, residente_id, tipo, monto, periodo, vencimiento, dias_restantes } = await req.json() as {
      factura_id:     string
      residente_id:   string
      tipo:           string
      monto:          number
      periodo:        string
      vencimiento:    string
      dias_restantes?: number  // Sprint 12 · PBI-S9-E02 — 0 = vence hoy; 3 = 3 días antes (default)
    }

    if (!factura_id || !residente_id || !tipo || monto === undefined || !vencimiento) {
      return jsonResponse(req, { error: "Parámetros inválidos" }, 400)
    }

    // "vence hoy" (día del vencimiento) | "vence mañana" | "vence en N días".
    const dias = typeof dias_restantes === "number" ? dias_restantes : 3
    const venceTexto = dias <= 0 ? "vence hoy" : dias === 1 ? "vence mañana" : `vence en ${dias} días`

    const supabaseAdmin = createServiceClient()

    // Datos del residente (email + nombre) para personalizar el correo.
    const { data: residente, error: resError } = await supabaseAdmin
      .from("usuarios")
      .select("email, nombre, apellido")
      .eq("id", residente_id)
      .single()

    if (resError || !residente) {
      return jsonResponse(req, { error: "Residente no encontrado" }, 404)
    }

    const TIPO_LABEL: Record<string, string> = {
      luz:     "Electricidad",
      agua:    "Agua",
      pension: "Pensión",
      multa:   "Multa",
      tienda:  "Tienda",
    }
    const tipoLabel = TIPO_LABEL[tipo] ?? tipo

    const [year, month] = periodo.split("-")
    const periodoLabel = new Date(Number(year), Number(month) - 1, 1)
      .toLocaleDateString("es", { month: "long", year: "numeric" })

    const montoLabel = new Intl.NumberFormat("es-PE", {
      style: "currency", currency: "PEN", minimumFractionDigits: 2,
    }).format(monto)

    const vencLabel = new Date(vencimiento + "T12:00:00").toLocaleDateString("es", {
      day: "numeric", month: "long", year: "numeric",
    })

    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
        <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">Tu factura ${venceTexto}</h2>
        <p>Hola <strong>${residente.nombre} ${residente.apellido}</strong>,</p>
        <p>Te recordamos que tienes una factura por pagar correspondiente al período <strong>${periodoLabel}</strong>:</p>

        <div style="background: #fffbeb; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #d97706;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Concepto</td>
              <td style="padding: 6px 0; font-weight: 600; text-align: right;">${tipoLabel}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Monto</td>
              <td style="padding: 6px 0; font-weight: 700; font-size: 20px; color: #0f172a; text-align: right;">${montoLabel}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Vence el</td>
              <td style="padding: 6px 0; font-weight: 600; color: #d97706; text-align: right;">${vencLabel}</td>
            </tr>
          </table>
        </div>

        <p style="font-size: 14px; color: #64748b;">
          Paga a tiempo para evitar que tu factura quede marcada como vencida. Puedes consultar el detalle en el panel de Zity.
        </p>
        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-bottom: 0;">
          Este es un correo automático de Zity. Por favor no respondas a este mensaje.
        </p>
      </div>
    `

    const resendApiKey = Deno.env.get("RESEND_API_KEY")
    const resendFrom   = Deno.env.get("RESEND_FROM_ADDRESS") ?? "Zity <no-reply@zity.site>"

    if (!resendApiKey) {
      // no-PII (DoD v3): se registran solo IDs, nunca el correo del residente.
      console.log("----- DRY-RUN EMAIL [recordatorios-facturas] -----")
      console.log(`Residente: ${residente_id}`)
      console.log(`Subject: [Zity] Tu factura de ${tipoLabel} ${venceTexto}`)
      console.log(`Factura ID: ${factura_id} · Vence: ${vencLabel}`)
      console.log("--------------------------------------------------")
      return jsonResponse(req, { success: true, mode: "dry-run" })
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from:    resendFrom,
        to:      [residente.email],
        subject: `[Zity] Tu factura de ${tipoLabel} ${venceTexto}`,
        html:    emailHtml,
      }),
    })

    if (!res.ok) {
      const errorText = await res.text()
      console.error(`[recordatorios-facturas] Resend error (residente ${residente_id}, factura ${factura_id}): ${errorText}`)
      throw new Error(`Fallo Resend: ${errorText}`)
    }

    const resData = await res.json() as { id: string }
    console.log(`[recordatorios-facturas] Email enviado (residente ${residente_id}, factura ${factura_id}, id: ${resData.id})`)
    return jsonResponse(req, { success: true, messageId: resData.id })

  } catch (error) {
    return jsonResponse(req, { error: (error as Error).message }, 500)
  }
})
