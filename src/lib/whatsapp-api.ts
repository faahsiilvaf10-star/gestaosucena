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

      // Convert w-api URL format if needed
      if (baseUrl.includes('painel.w-api.app')) {
        baseUrl = 'https://api.w-api.app/v1'
      } else if (baseUrl.includes('api.w-api.app') && !baseUrl.includes('/v1')) {
        baseUrl = baseUrl + '/v1'
      }

      // Default Evolution API endpoint
      let endpoint = `${baseUrl}/message/sendText/${data.instanceId}`;
      
      // If it's w-api.app, use their specific query param structure
      if (baseUrl.includes('api.w-api.app')) {
        endpoint = `${baseUrl}/messages/send-text?instanceId=${data.instanceId}`
      }

      const payload = {
        number: data.phone,
        phone: data.phone,
        text: data.text,
        message: data.text
      }

      let res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${data.token}`,
          'apikey': data.token
        },
        body: JSON.stringify(payload)
      })

      // Fallbacks if 404
      if (res.status === 404) {
        const fallbackEndpoint = endpoint.includes('/message/') 
          ? endpoint.replace('/message/', '/messages/') 
          : endpoint.replace('/messages/', '/message/')
          
        res = await fetch(fallbackEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${data.token}`,
            'apikey': data.token
          },
          body: JSON.stringify(payload)
        })
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
    base64Media: string,
    fileName?: string
  }) => data)
  .handler(async ({ data }) => {
    try {
      let baseUrl = data.url.trim()
      if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1)

      // Convert w-api URL format if needed
      if (baseUrl.includes('painel.w-api.app')) {
        baseUrl = 'https://api.w-api.app/v1'
      } else if (baseUrl.includes('api.w-api.app') && !baseUrl.includes('/v1')) {
        baseUrl = baseUrl + '/v1'
      }

      // Default Evolution API endpoint
      let endpoint = `${baseUrl}/message/sendMedia/${data.instanceId}`;
      
      // If it's w-api.app
      if (baseUrl.includes('api.w-api.app')) {
        endpoint = `${baseUrl}/messages/send-media?instanceId=${data.instanceId}`
      }

      // Base64 gerado pelo canvas vem como "data:image/png;base64,iVBORw0KGgo..."
      let pureBase64 = data.base64Media
      if (pureBase64.includes('base64,')) {
        pureBase64 = pureBase64.split('base64,')[1]
      }

      const payload = {
        number: data.phone,
        phone: data.phone,
        mediatype: "image",
        mimetype: "image/png",
        fileName: data.fileName || "documento.png",
        caption: data.caption,
        message: data.caption,
        media: pureBase64,
        base64: pureBase64
      }

      let res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${data.token}`,
          'apikey': data.token
        },
        body: JSON.stringify(payload)
      })

      if (res.status === 404) {
        const fallbackEndpoint = endpoint.includes('/message/') 
          ? endpoint.replace('/message/', '/messages/') 
          : endpoint.replace('/messages/', '/message/')
          
        res = await fetch(fallbackEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${data.token}`,
            'apikey': data.token
          },
          body: JSON.stringify(payload)
        })
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
