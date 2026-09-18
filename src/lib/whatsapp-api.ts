import { createServerFn } from '@tanstack/react-start'

export const sendWhatsappTextOnServer = createServerFn({ method: 'POST' })
  .validator((data: {
    url: string,
    token: string,
    instanceId: string,
    phone: string,
    text: string
  }) => data)
  .handler(async ({ data }) => {
    try {
      let baseUrl = data.url.trim()
      if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1)

      let baseEndpoint = `${baseUrl}/message/sendText/${data.instanceId}`;
      if (baseUrl.includes('painel.w-api.app')) {
        baseEndpoint = `https://api.w-api.app/message/sendText/${data.instanceId}`;
      }

      const payload = {
        number: data.phone,
        text: data.text
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

      if (!res.ok) {
         let fallbackEndpoint = `${baseUrl}/messages/send`;
         if (baseUrl.includes('painel.w-api.app')) fallbackEndpoint = `https://api.w-api.app/messages/send`;
         
         const fbPayload = {
            number: data.phone,
            body: data.text
         };

         res = await fetch(fallbackEndpoint, {
            method: 'POST',
            headers: {
               'Content-Type': 'application/json',
               'Authorization': `Bearer ${data.token}`
            },
            body: JSON.stringify(fbPayload)
         });
      }

      const resultText = await res.text();
      return { success: res.ok, result: resultText };
    } catch (e: any) {
      console.error("sendWhatsappTextOnServer error:", e)
      return { success: false, error: e.message }
    }
  })

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

      if (res.status === 404 || res.status === 400) {
        // Fallback for different W-API / Evolution versions
        const wApiPayload = {
          phone: data.phone,
          image: data.base64Media, // W-API specific uses data:image/png;base64...
          caption: data.caption
        };

        const fallbacks = [
          { url: baseEndpoint.replace('/message/sendMedia/', '/messages/sendMedia/'), payload },
          { url: `${baseUrl}/v1/messages/sendMedia?instanceId=${data.instanceId}`, payload },
          { url: `${baseUrl}/messages/sendMedia?instanceId=${data.instanceId}`, payload },
          { url: `${baseUrl}/v1/message/sendMedia/${data.instanceId}`, payload },
          { url: `${baseUrl}/v1/message/send-image?instanceId=${data.instanceId}`, payload: wApiPayload },
          { url: `${baseUrl}/message/send-image?instanceId=${data.instanceId}`, payload: wApiPayload }
        ]

        for (const fb of fallbacks) {
          res = await fetch(fb.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${data.token}`,
              'apikey': data.token
            },
            body: JSON.stringify(fb.payload)
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
