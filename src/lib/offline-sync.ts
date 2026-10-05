import localforage from 'localforage';
import { supabase } from './supabase';

// Configure localforage
localforage.config({
  name: 'SucenaAppMotorista',
  version: 1.0,
  storeName: 'offline_store',
  description: 'Armazenamento offline para o App Motorista'
});

const QUEUE_KEY = 'sync_queue';

// DIRECT FETCH FALLBACKS FOR APK
const directWhatsappSendText = async (settings: any, phone: string, text: string) => {
  let baseUrl = settings.url.trim();
  if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
  if (baseUrl.includes('painel.w-api.app')) baseUrl = 'https://api.w-api.app/v1';
  else if (baseUrl.includes('api.w-api.app') && !baseUrl.includes('/v1')) baseUrl = baseUrl + '/v1';

  let endpoint = `${baseUrl}/message/sendText/${settings.instanceId}`;
  if (baseUrl.includes('api.w-api.app')) endpoint = `${baseUrl}/messages/send-text?instanceId=${settings.instanceId}`;

  const payload = { number: phone, phone: phone, text, message: text };
  let res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.token}`, 'apikey': settings.token },
    body: JSON.stringify(payload)
  });
  if (res.status === 404) {
    const fallback = endpoint.includes('/message/') ? endpoint.replace('/message/', '/messages/') : endpoint.replace('/messages/', '/message/');
    res = await fetch(fallback, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.token}`, 'apikey': settings.token },
      body: JSON.stringify(payload)
    });
  }
  if (!res.ok) throw new Error("Direct fetch text failed: " + await res.text());
  return true;
};

const directWhatsappSendMedia = async (settings: any, phone: string, caption: string, base64Media: string, fileName: string) => {
  let baseUrl = settings.url.trim();
  if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
  if (baseUrl.includes('painel.w-api.app')) baseUrl = 'https://api.w-api.app/v1';
  else if (baseUrl.includes('api.w-api.app') && !baseUrl.includes('/v1')) baseUrl = baseUrl + '/v1';

  let endpoint = `${baseUrl}/message/sendMedia/${settings.instanceId}`;
  let isWApiApp = false;
  if (baseUrl.includes('api.w-api.app')) {
    isWApiApp = true;
    endpoint = `${baseUrl}/message/send-image?instanceId=${settings.instanceId}`;
  }

  let pureBase64 = base64Media;
  let mime = "image/png";
  if (pureBase64.includes('image/jpeg') || fileName?.endsWith('.jpg') || fileName?.endsWith('.jpeg')) mime = "image/jpeg";
  if (pureBase64.includes('base64,')) pureBase64 = pureBase64.split('base64,')[1];

  const payload = isWApiApp ? {
    phone, number: phone, image: base64Media, caption
  } : {
    number: phone, phone, mediatype: "image", mimetype: mime, fileName: fileName || "documento.png",
    caption, message: caption, media: pureBase64, base64: pureBase64
  };

  let res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.token}`, 'apikey': settings.token },
    body: JSON.stringify(payload)
  });
  if (res.status === 404) {
    const fallback = endpoint.includes('/message/') ? endpoint.replace('/message/', '/messages/') : endpoint.replace('/messages/', '/message/');
    res = await fetch(fallback, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.token}`, 'apikey': settings.token },
      body: JSON.stringify(payload)
    });
  }
  if (!res.ok) throw new Error("Direct fetch media failed: " + await res.text());
  return true;
};

export type SyncAction = 'INSERT' | 'UPDATE' | 'UPSERT' | 'WHATSAPP';

export interface SyncTask {
  id: string; // Unique ID for the task
  table: string; // If action is WHATSAPP, table will be 'whatsapp'
  action: SyncAction;
  data: any;
  timestamp: number;
}

// Add task to offline queue
export const addToSyncQueue = async (task: Omit<SyncTask, 'id' | 'timestamp'>) => {
  try {
    const currentQueue: SyncTask[] = await localforage.getItem(QUEUE_KEY) || [];
    const newTask: SyncTask = {
      ...task,
      id: crypto.randomUUID(),
      timestamp: Date.now()
    };
    await localforage.setItem(QUEUE_KEY, [...currentQueue, newTask]);
    return newTask;
  } catch (error) {
    console.error('Erro ao adicionar na fila offline:', error);
    throw error;
  }
};

// Get current queue
export const getSyncQueue = async (): Promise<SyncTask[]> => {
  return await localforage.getItem(QUEUE_KEY) || [];
};

// Process queue when online
let isSyncing = false;
export const processSyncQueue = async () => {
  if (typeof navigator === 'undefined' || !navigator.onLine || isSyncing) return;
  isSyncing = true;

  try {
    const queue = await getSyncQueue();
    if (queue.length === 0) return;

    console.log(`[OfflineSync] Iniciando sincronização de ${queue.length} itens...`);
    
    const failedTasks: SyncTask[] = [];

  for (const task of queue) {
    try {
      let result;
      if (task.action === 'INSERT') {
        result = await supabase.from(task.table).insert(task.data);
      } else if (task.action === 'UPDATE') {
        // Assume data has an id for updating
        result = await supabase.from(task.table).update(task.data).eq('id', task.data.id);
      } else if (task.action === 'UPSERT') {
        result = await supabase.from(task.table).upsert(task.data);
      } else if (task.action === 'WHATSAPP') {
        if (task.data.isMedia) {
          try {
            const { sendWhatsappMediaOnServer } = await import('./whatsapp-api');
            const payload = {
              data: {
                url: task.data.settings.url,
                token: task.data.settings.token,
                instanceId: task.data.settings.instanceId,
                phone: task.data.phone,
                caption: task.data.message,
                base64Media: task.data.base64Media,
                fileName: task.data.fileName
              }
            };
            const res = await sendWhatsappMediaOnServer(payload as any);
            if (!res.success) throw new Error('Falha media: ' + ((res as any).error || ''));
          } catch (serverErr) {
            console.warn('Server media fetch failed, fallback to direct fetch', serverErr);
            await directWhatsappSendMedia(task.data.settings, task.data.phone, task.data.message, task.data.base64Media, task.data.fileName);
          }
        } else {
          try {
            const { sendWhatsappTextOnServer } = await import('./whatsapp-api');
            const payload = {
              data: {
                url: task.data.settings.url,
                token: task.data.settings.token,
                instanceId: task.data.settings.instanceId,
                phone: task.data.phone,
                text: task.data.message
              }
            };
            const res = await sendWhatsappTextOnServer(payload as any);
            if (!res.success) throw new Error('Falha text: ' + ((res as any).error || ''));
          } catch (serverErr) {
            console.warn('Server text fetch failed, fallback to direct fetch', serverErr);
            await directWhatsappSendText(task.data.settings, task.data.phone, task.data.message);
          }
        }
        result = { error: null };
      }

      if (result?.error) {
        throw result.error;
      }
    } catch (error) {
      console.error(`Erro ao sincronizar tarefa ${task.id} (${task.table}):`, error);
      failedTasks.push(task); // Keep failed tasks to retry later
    }
  }

  // Update queue with only failed tasks
  await localforage.setItem(QUEUE_KEY, failedTasks);
  
  if (failedTasks.length > 0) {
    console.warn(`${failedTasks.length} itens falharam ao sincronizar e foram mantidos na fila.`);
  } else {
    console.log('Sincronização concluída com sucesso!');
  }
} finally {
  isSyncing = false;
}
};

// Auto-sincronização automática quando a rede voltar
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[OfflineSync] Internet detectada! Processando fila offline...');
    setTimeout(processSyncQueue, 1000);
  });

  // Tenta sincronizar 3s após o app abrir se já estiver online
  if (navigator.onLine) {
    setTimeout(processSyncQueue, 3000);
  }
}

// Generic Offline-first save wrapper
export const saveOfflineFirst = async (table: string, action: SyncAction, data: any) => {
  if (navigator.onLine) {
    try {
      // Try to save directly
      let result;
      if (action === 'INSERT') {
        result = await supabase.from(table).insert(data).select();
      } else if (action === 'UPDATE') {
        result = await supabase.from(table).update(data).eq('id', data.id).select();
      } else if (action === 'UPSERT') {
        result = await supabase.from(table).upsert(data).select();
      }

      if (result?.error) throw result.error;
      return { success: true, data: result?.data, offline: false };
    } catch (error) {
      console.warn('Erro ao salvar online, caindo para modo offline:', error);
      // Fallback to offline
      await addToSyncQueue({ table, action, data });
      return { success: true, data: data, offline: true };
    }
  } else {
    // Offline immediately
    await addToSyncQueue({ table, action, data });
    return { success: true, data: data, offline: true };
  }
};

export const queueWhatsappMessage = async (settings: any, phone: string, message: string) => {
  const taskData = { settings, phone, message };
  if (navigator.onLine) {
    try {
      const { sendWhatsappTextOnServer } = await import('./whatsapp-api');
      const payload = {
        data: {
          url: settings.url,
          token: settings.token,
          instanceId: settings.instanceId,
          phone: phone,
          text: message
        }
      };
      const res = await sendWhatsappTextOnServer(payload as any);
      if (!res.success) throw new Error((res as any)?.error || 'Unknown error');
      return { success: true, offline: false };
    } catch (error) {
      console.warn('Server text fetch failed online, fallback to direct fetch:', error);
      try {
        await directWhatsappSendText(settings, phone, message);
        return { success: true, offline: false };
      } catch (fallbackError) {
        console.warn('Direct fallback also failed, enfileirando:', fallbackError);
        await addToSyncQueue({ table: 'whatsapp', action: 'WHATSAPP', data: taskData });
        return { success: true, offline: true };
      }
    }
  } else {
    await addToSyncQueue({ table: 'whatsapp', action: 'WHATSAPP', data: taskData });
    return { success: true, offline: true };
  }
};

export const queueWhatsappMedia = async (settings: any, phone: string, caption: string, base64Media: string, fileName: string) => {
  const taskData = { settings, phone, message: caption, base64Media, fileName, isMedia: true };
  if (navigator.onLine) {
    try {
      const { sendWhatsappMediaOnServer } = await import('./whatsapp-api');
      const payload = {
        data: {
          url: settings.url,
          token: settings.token,
          instanceId: settings.instanceId,
          phone: phone,
          caption: caption,
          base64Media,
          fileName
        }
      };
      const res = await sendWhatsappMediaOnServer(payload as any);
      if (!res.success) throw new Error((res as any)?.error || 'Unknown error');
      return { success: true, offline: false };
    } catch (error) {
      console.warn('Server media fetch failed online, fallback to direct fetch:', error);
      try {
        await directWhatsappSendMedia(settings, phone, caption, base64Media, fileName);
        return { success: true, offline: false };
      } catch (fallbackError) {
        console.warn('Direct media fallback also failed, enfileirando:', fallbackError);
        await addToSyncQueue({ table: 'whatsapp', action: 'WHATSAPP', data: taskData });
        return { success: true, offline: true };
      }
    }
  } else {
    await addToSyncQueue({ table: 'whatsapp', action: 'WHATSAPP', data: taskData });
    return { success: true, offline: true };
  }
};
