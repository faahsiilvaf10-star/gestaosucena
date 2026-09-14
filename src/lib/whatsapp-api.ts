import { createServerFn } from '@tanstack/react-start'

export const sendWhatsappMediaOnServer = createServerFn({ method: 'POST' })
  .validator((data: {
    url: string,
    token: string,
    instanceId: string,
    phone: string,
    caption: string,
    base64Media: string
  }) => data)
  .handler(async ({ data }) => {
    try {
      let baseUrl = data.url.trim()
      if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1)

      // Determina endpoint (a URL salva nas configs é a baseUrl)
      let baseEndpoint = `${baseUrl}/message/sendMedia/${data.instanceId}`;
      if (baseUrl.includes('painel.w-api.app')) {
        baseEndpoint = `https://api.w-api.app/message/sendMedia/${data.instanceId}`;
      }

      // Base64 gerado pelo canvas vem como "data:image/png;base64,iVBORw0KGgo..."
      // A doc oficial Evolution API usa "media": "base64 puro sem data:image".
      let pureBase64 = data.base64Media
      if (pureBase64.includes('base64,')) {
        pureBase64 = pureBase64.split('base64,')[1]
      }

      const payload = {
        number: data.phone,
        mediatype: "image",
        mimetype: "image/png",
        fileName: "requisicao.png",
        caption: data.caption,
        media: pureBase64
      }

      let res = await fetch(baseEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${data.token}`,
          'apikey': data.token
        },
        body: JSON.stringify(payload)
      })

      if (res.status === 404) {
        // Fallback for different W-API / Evolution versions
        const fallbacks = [
          baseEndpoint.replace('/message/sendMedia/', '/messages/sendMedia/'),
          `${baseUrl}/v1/messages/sendMedia?instanceId=${data.instanceId}`,
          `${baseUrl}/messages/sendMedia?instanceId=${data.instanceId}`,
          `${baseUrl}/v1/message/sendMedia/${data.instanceId}`
        ]

        for (const fb of fallbacks) {
          res = await fetch(fb, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${data.token}`,
              'apikey': data.token
            },
            body: JSON.stringify(payload)
          })
          if (res.ok) break;
        }
      }

      const text = await res.text()
      if (!res.ok) {
        throw new Error(`W-API error (${res.status}): ${text}`)
      }
      return { success: true, response: text }
    } catch (e: any) {
      console.error("sendWhatsappMediaOnServer error:", e)
      throw new Error(e.message || "Erro no envio W-API")
    }
  })
