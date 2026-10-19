// API endpoint de proxy para WhatsApp — permite que o APK (sem server-side)
// envie mensagens sem ser bloqueado por CORS
import { json } from "@tanstack/react-start";

interface WhatsAppProxyRequest {
  url: string;
  token: string;
  instanceId: string;
  phone: string;
  text?: string;
  caption?: string;
  base64Media?: string;
  fileName?: string;
  imageUrl?: string;
  mediaType?: 'text' | 'image';
}

// Cria um fetch com SSL bypass para w-api.app
async function fetchWithSslBypass(url: string, options: RequestInit): Promise<Response> {
  if (url.includes("w-api.app") || url.includes("painel.w-api.app")) {
    try {
      const { Agent } = await import("undici");
      const agent = new Agent({ connect: { rejectUnauthorized: false } });
      return fetch(url, { ...options, dispatcher: agent } as any);
    } catch {
      const prevTLS = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
      try {
        return await fetch(url, options);
      } finally {
        if (prevTLS === undefined) {
          delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
        } else {
          process.env.NODE_TLS_REJECT_UNAUTHORIZED = prevTLS;
        }
      }
    }
  }
  return fetch(url, options);
}

export async function POST({ request }: { request: Request }) {
  try {
    const body: WhatsAppProxyRequest = await request.json();

    if (!body.url || !body.token || !body.instanceId || !body.phone) {
      return json({ success: false, error: "Parâmetros obrigatórios faltando" }, { status: 400 });
    }

    let baseUrl = body.url.trim();
    if (baseUrl.endsWith("/")) baseUrl = baseUrl.slice(0, -1);

    // Normaliza URL da w-api
    if (baseUrl.includes("painel.w-api.app")) {
      baseUrl = "https://api.w-api.app/v1";
    } else if (baseUrl.includes("api.w-api.app") && !baseUrl.includes("/v1")) {
      baseUrl = baseUrl + "/v1";
    }

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${body.token}`,
      apikey: body.token,
    };

    // Determina tipo de mensagem
    const isMedia = body.mediaType === "image" && (body.base64Media || body.imageUrl);
    const isWApi = baseUrl.includes("api.w-api.app");

    let endpoint: string;
    let payload: any;

    if (isMedia) {
      // Envio de mídia (imagem)
      endpoint = isWApi
        ? `${baseUrl}/messages/send-image?instanceId=${body.instanceId}`
        : `${baseUrl}/message/sendMedia/${body.instanceId}`;

      let pureBase64 = body.base64Media || "";
      if (pureBase64.includes("base64,")) {
        pureBase64 = pureBase64.split("base64,")[1];
      }

      if (isWApi) {
        payload = {
          phone: body.phone,
          number: body.phone,
          image: body.base64Media,
          media: body.base64Media,
          imageUrl: body.imageUrl,
          mediaUrl: body.imageUrl,
          caption: body.caption,
        };
      } else {
        payload = {
          number: body.phone,
          phone: body.phone,
          mediatype: "image",
          mimetype: "image/png",
          fileName: body.fileName || "documento.png",
          caption: body.caption,
          message: body.caption,
          media: pureBase64,
          base64: pureBase64,
        };
      }
    } else {
      // Envio de texto
      endpoint = isWApi
        ? `${baseUrl}/messages/send-text?instanceId=${body.instanceId}`
        : `${baseUrl}/message/sendText/${body.instanceId}`;

      payload = {
        number: body.phone,
        phone: body.phone,
        text: body.text,
        message: body.text,
      };
    }

    // Tenta endpoint principal
    let res = await fetchWithSslBypass(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });

    // Fallback: troca /message/ <-> /messages/
    if (!res.ok && res.status === 404) {
      const fallbackEndpoint = endpoint.includes("/message/")
        ? endpoint.replace("/message/", "/messages/")
        : endpoint.replace("/messages/", "/message/");

      if (fallbackEndpoint !== endpoint) {
        res = await fetchWithSslBypass(fallbackEndpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(15000),
        });
      }
    }

    const resultText = await res.text();

    if (res.ok) {
      return json({ success: true, result: resultText });
    } else {
      return json({ success: false, error: `W-API error (${res.status}): ${resultText}` }, { status: res.status });
    }
  } catch (err: any) {
    console.error("[WhatsApp Proxy] Erro:", err);
    return json({ success: false, error: err.message || "Erro interno do servidor" }, { status: 500 });
  }
}
