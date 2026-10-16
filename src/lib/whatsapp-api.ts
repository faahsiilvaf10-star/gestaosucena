import { createServerFn } from "@tanstack/react-start";
import { Capacitor, CapacitorHttp } from "@capacitor/core";

function getAlternativeEndpoint(ep: string): string {
  if (ep.includes("/messages/")) {
    return ep.replace("/messages/", "/message/");
  }
  if (ep.includes("/message/")) {
    return ep.replace("/message/", "/messages/");
  }
  return ep;
}

export async function executeWhatsappHttp(
  endpoint: string,
  headers: Record<string, string>,
  payload: any,
) {
  // Se estiver executando no APK nativo (Capacitor Android/iOS), usa HTTP nativo contornando restrições de CORS do WebView
  if (Capacitor.isNativePlatform()) {
    try {
      let res = await CapacitorHttp.post({
        url: endpoint,
        headers,
        data: payload,
      });

      if (res.status === 404) {
        const fallbackEndpoint = getAlternativeEndpoint(endpoint);
        if (fallbackEndpoint !== endpoint) {
          res = await CapacitorHttp.post({
            url: fallbackEndpoint,
            headers,
            data: payload,
          });
        }
      }

      const text = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
      if (res.status >= 200 && res.status < 300) {
        return { ok: true, status: res.status, text };
      }
      return { ok: false, status: res.status, text };
    } catch (nativeErr: any) {
      console.warn("[WhatsApp] CapacitorHttp falhou, caindo para fetch:", nativeErr);
    }
  }

  // Fallback para fetch padrão (Node.js no servidor SSR ou navegador web)
  let res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  // Fallback se 404
  if (res.status === 404) {
    const fallbackEndpoint = getAlternativeEndpoint(endpoint);
    if (fallbackEndpoint !== endpoint) {
      res = await fetch(fallbackEndpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
    }
  }

  const resultText = await res.text();
  return { ok: res.ok, status: res.status, text: resultText };
}

export const sendWhatsappTextOnServer = createServerFn({ method: "POST" })
  .validator(
    (data: { url: string; token: string; instanceId: string; phone: string; text: string }) => data,
  )
  .handler(async ({ data }) => {
    try {
      let baseUrl = data.url.trim();
      if (baseUrl.endsWith("/")) baseUrl = baseUrl.slice(0, -1);

      // Convert w-api URL format if needed
      if (baseUrl.includes("painel.w-api.app")) {
        baseUrl = "https://api.w-api.app/v1";
      } else if (baseUrl.includes("api.w-api.app") && !baseUrl.includes("/v1")) {
        baseUrl = baseUrl + "/v1";
      }

      // Default Evolution API endpoint
      let endpoint = `${baseUrl}/message/sendText/${data.instanceId}`;

      // If it's w-api.app, use their specific query param structure (/message/send-text)
      if (baseUrl.includes("api.w-api.app")) {
        endpoint = `${baseUrl}/message/send-text?instanceId=${data.instanceId}`;
      }

      const payload = {
        number: data.phone,
        phone: data.phone,
        text: data.text,
        message: data.text,
      };

      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.token}`,
        apikey: data.token,
      };

      const res = await executeWhatsappHttp(endpoint, headers, payload);

      if (!res.ok) {
        throw new Error(`W-API error (${res.status}): ${res.text}`);
      }
      return { success: true, result: res.text };
    } catch (e: any) {
      console.error("sendWhatsappTextOnServer error:", e);
      throw new Error(e.message || "Erro no envio W-API");
    }
  });

export const sendWhatsappMediaOnServer = createServerFn({ method: "POST" })
  .validator(
    (data: {
      url: string;
      token: string;
      instanceId: string;
      phone: string;
      caption: string;
      base64Media: string;
      fileName?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    try {
      let baseUrl = data.url.trim();
      if (baseUrl.endsWith("/")) baseUrl = baseUrl.slice(0, -1);

      // Convert w-api URL format if needed
      if (baseUrl.includes("painel.w-api.app")) {
        baseUrl = "https://api.w-api.app/v1";
      } else if (baseUrl.includes("api.w-api.app") && !baseUrl.includes("/v1")) {
        baseUrl = baseUrl + "/v1";
      }

      // Default Evolution API endpoint
      let endpoint = `${baseUrl}/message/sendMedia/${data.instanceId}`;

      let isWApiApp = false;
      // If it's w-api.app
      if (baseUrl.includes("api.w-api.app")) {
        isWApiApp = true;
        endpoint = `${baseUrl}/message/send-image?instanceId=${data.instanceId}`;
      }

      // Base64 gerado pelo canvas vem como "data:image/png;base64,iVBORw0KGgo..."
      let pureBase64 = data.base64Media;
      let mime = "image/png";
      if (pureBase64.includes("image/jpeg")) mime = "image/jpeg";
      else if (data.fileName?.endsWith(".jpg") || data.fileName?.endsWith(".jpeg"))
        mime = "image/jpeg";

      if (pureBase64.includes("base64,")) {
        pureBase64 = pureBase64.split("base64,")[1];
      }

      // Format payload depending on API
      // W-API requires "image" with full data URL, Evolution expects pureBase64 in "media"
      const payload = isWApiApp
        ? {
            phone: data.phone,
            number: data.phone,
            image: data.base64Media, // full base64 data URI
            caption: data.caption,
          }
        : {
            number: data.phone,
            phone: data.phone,
            mediatype: "image",
            mimetype: mime,
            fileName: data.fileName || "documento.png",
            caption: data.caption,
            message: data.caption,
            media: pureBase64,
            base64: pureBase64,
          };

      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.token}`,
        apikey: data.token,
      };

      const res = await executeWhatsappHttp(endpoint, headers, payload);

      if (!res.ok) {
        throw new Error(`W-API error (${res.status}): ${res.text}`);
      }
      return { success: true, response: res.text };
    } catch (e: any) {
      console.error("sendWhatsappMediaOnServer error:", e);
      throw new Error(e.message || "Erro no envio W-API");
    }
  });
