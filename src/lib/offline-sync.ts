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

export type SyncAction = 'INSERT' | 'UPDATE' | 'UPSERT';

export interface SyncTask {
  id: string; // Unique ID for the task
  table: string;
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
export const processSyncQueue = async () => {
  if (!navigator.onLine) return;

  const queue = await getSyncQueue();
  if (queue.length === 0) return;

  console.log(`Iniciando sincronização de ${queue.length} itens...`);
  
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
};

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
