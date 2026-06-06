/* eslint-disable no-console */
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders, jsonResponse, createServiceClient } from "../_shared/auth.ts"

// Sprint 8 · HU-FACT-05 — Edge Function para email de nueva factura.
// Disparada por after_factura_inserted (pg_net) de forma fire-and-forget.
// Si RESEND_API_KEY está ausente → dry-run (log de consola, responde 200).
// Si falla → el trigger ya captura la excepción, la factura no se revierte.

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) })
  }

  try {
    const { factura_id, residente_id, tipo, monto, periodo, vencimiento } = await req.json() as {
      factura_id:   string
      residente_id: string
      tipo:         string
      monto:        number
      periodo:      string
      vencimiento:  string
    }

    if (!factura_id || !residente_id || !tipo || monto === undefined || !periodo || !vencimiento) {
      return jsonResponse(req, { error: "Parámetros inválidos" }, 400)
    }

    const supabaseAdmin = createServiceClient()

    // Obtener datos del residente
    const { data: residente, error: resError } = await supabaseAdmin
      .from("usuarios")
      .select("email, nombre, apellido")
      .eq("id", residente_id)
      .single()

    if (resError || !residente) {
      return jsonResponse(req, { error: "Residente no encontrado" }, 404)
    }

    // Labels legibles
    const TIPO_LABEL: Record<string, string> = {
      luz:     "Electricidad",
      agua:    "Agua",
      pension: "Pensión",
      multa:   "Multa",
      tienda:  "Tienda",
    }
    const tipoLabel = TIPO_LABEL[tipo] ?? tipo

    // Formato de período legible: "2026-05" → "Mayo 2026"
    const [year, month] = periodo.split("-")
    const periodoFecha = new Date(Number(year), Number(month) - 1, 1)
    const periodoLabel = periodoFecha.toLocaleDateString("es", { month: "long", year: "numeric" })

    // Formato de monto con 2 decimales
    const montoLabel = new Intl.NumberFormat("es-PE", {
      style: "currency", currency: "PEN", minimumFractionDigits: 2,
    }).format(monto)

    // Fecha de vencimiento legible: "2026-05-31" → "31 de mayo de 2026"
    const vencLabel = new Date(vencimiento + "T12:00:00").toLocaleDateString("es", {
      day: "numeric", month: "long", year: "numeric",
    })

    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
        <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">Nueva factura emitida</h2>
        <p>Hola <strong>${residente.nombre} ${residente.apellido}</strong>,</p>
        <p>Se ha emitido una nueva factura a tu cuenta correspondiente al período <strong>${periodoLabel}</strong>:</p>

        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0f4c8a;">
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
              <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Vencimiento</td>
              <td style="padding: 6px 0; font-weight: 600; color: #dc2626; text-align: right;">${vencLabel}</td>
            </tr>
          </table>
        </div>

        <p style="font-size: 14px; color: #64748b;">
          Puedes consultar el detalle y el historial de tus facturas en el panel de Zity.
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
      console.log("----- DRY-RUN EMAIL [notificar-factura-nueva] -----")
      console.log(`Residente: ${residente_id}`)
      console.log(`Subject: [Zity] Nueva factura: ${tipoLabel} — ${montoLabel}`)
      console.log(`Factura ID: ${factura_id}`)
      console.log("---------------------------------------------------")
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
        subject: `[Zity] Nueva factura: ${tipoLabel} — ${montoLabel}`,
        html:    emailHtml,
      }),
    })

    if (!res.ok) {
      const errorText = await res.text()
      console.error(`[notificar-factura-nueva] Resend error (residente ${residente_id}, factura ${factura_id}): ${errorText}`)
      throw new Error(`Fallo Resend: ${errorText}`)
    }

    const resData = await res.json() as { id: string }
    console.log(`[notificar-factura-nueva] Email enviado (residente ${residente_id}, factura ${factura_id}, id: ${resData.id})`)
    return jsonResponse(req, { success: true, messageId: resData.id })

  } catch (error) {
    return jsonResponse(req, { error: (error as Error).message }, 500)
  }
})
