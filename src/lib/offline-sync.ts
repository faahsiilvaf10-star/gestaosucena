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
          if (!res.success) throw new Error('Falha media: ' + res.error);
        } else {
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
          if (!res.success) throw new Error('Falha text: ' + res.error);
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
      if (!res.success) throw new Error(res.error || 'Unknown error');
      return { success: true, offline: false };
    } catch (error) {
      console.warn('Erro ao enviar whatsapp online, enfileirando:', error);
      await addToSyncQueue({ table: 'whatsapp', action: 'WHATSAPP', data: taskData });
      return { success: true, offline: true };
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
      if (!res.success) throw new Error(res.error || 'Unknown error');
      return { success: true, offline: false };
    } catch (error) {
      console.warn('Erro ao enviar whatsapp media online, enfileirando:', error);
      await addToSyncQueue({ table: 'whatsapp', action: 'WHATSAPP', data: taskData });
      return { success: true, offline: true };
    }
  } else {
    await addToSyncQueue({ table: 'whatsapp', action: 'WHATSAPP', data: taskData });
    return { success: true, offline: true };
  }
};
