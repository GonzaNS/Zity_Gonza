/* eslint-disable no-console */
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders, jsonResponse, createServiceClient } from "../_shared/auth.ts"

// Edge function para enviar correo de notificación ante cambio de estado de solicitud.
// Dispara llamada a Resend con plantilla HTML mínima.
// Si RESEND_API_KEY está ausente (entorno local), responde 200 y loguea (modo dry-run).

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) })
  }

  try {
    const { solicitud_id, estado_nuevo, cambiado_por } = await req.json() as {
      solicitud_id: string
      estado_nuevo: string
      cambiado_por: string
    }

    if (!solicitud_id || !estado_nuevo || !cambiado_por) {
      return jsonResponse(req, { error: "Parámetros inválidos" }, 400)
    }

    const supabaseAdmin = createServiceClient()

    // 1. Obtener datos de la solicitud
    const { data: solicitud, error: solError } = await supabaseAdmin
      .from("solicitudes")
      .select("codigo, residente_id, descripcion")
      .eq("id", solicitud_id)
      .single()

    if (solError || !solicitud) {
      return jsonResponse(req, { error: "Solicitud no encontrada" }, 404)
    }

    // 2. Obtener datos del residente
    const { data: residente, error: resError } = await supabaseAdmin
      .from("usuarios")
      .select("email, nombre, apellido")
      .eq("id", solicitud.residente_id)
      .single()

    if (resError || !residente) {
      return jsonResponse(req, { error: "Residente no encontrado" }, 404)
    }

    // 3. Obtener datos del autor del cambio
    const { data: autor, error: autorError } = await supabaseAdmin
      .from("usuarios")
      .select("nombre, apellido, rol")
      .eq("id", cambiado_por)
      .single()

    const autorNombre = autorError || !autor ? "Un usuario" : `${autor.nombre} ${autor.apellido} (${autor.rol})`

    // Plantilla HTML mínima para el correo
    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
        <h2 style="color: #0f172a; margin-top: 0;">Actualización de tu solicitud</h2>
        <p>Hola <strong>${residente.nombre} ${residente.apellido}</strong>,</p>
        <p>Te informamos que tu solicitud con código <strong>${solicitud.codigo}</strong> ha cambiado de estado:</p>
        
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #0284c7;">
          <p style="margin: 0; font-size: 16px;"><strong>Nuevo estado:</strong> <span style="text-transform: uppercase; color: #0284c7;">${estado_nuevo.replace("_", " ")}</span></p>
          <p style="margin: 5px 0 0 0; font-size: 14px; color: #64748b;"><strong>Actualizado por:</strong> ${autorNombre}</p>
        </div>

        <p style="color: #64748b; font-size: 14px;">Descripción de la solicitud:<br><em>"${solicitud.descripcion}"</em></p>
        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-bottom: 0;">Este es un correo automático de Zity. Por favor no respondas a este mensaje.</p>
      </div>
    `

    const resendApiKey = Deno.env.get("RESEND_API_KEY")

    if (!resendApiKey) {
      console.log("----- DRY-RUN EMAIL -----")
      console.log(`To: ${residente.email}`)
      console.log(`Subject: [Zity] Actualización de la solicitud ${solicitud.codigo}`)
      console.log("Body HTML:")
      console.log(emailHtml)
      console.log("-------------------------")
      return jsonResponse(req, { success: true, mode: "dry-run" })
    }

    // Llamada a Resend API
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Zity Condominios <no-reply@zity.site>",
        to: [residente.email],
        subject: `[Zity] Actualización de la solicitud ${solicitud.codigo}`,
        html: emailHtml,
      }),
    })

    if (!res.ok) {
      const errorText = await res.text()
      throw new Error(`Fallo al enviar correo vía Resend: ${errorText}`)
    }

    const resData = await res.json()
    return jsonResponse(req, { success: true, messageId: resData.id })
  } catch (error) {
    return jsonResponse(req, { error: (error as Error).message }, 500)
  }
})
