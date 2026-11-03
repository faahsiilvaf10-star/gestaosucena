import { supabase } from './supabase';
import { isAdmin } from '../components/ui/VerifiedBadge';

export interface SafetyBanner {
  id: string;
  kicker: string;        // Ex: "NOSSA PRIORIDADE"
  title: string;         // Ex: "Segurança em primeiro lugar"
  description: string;   // Ex: "Trabalhar com segurança é cuidar de você, da sua família e do nosso futuro."
  buttonText: string;    // Ex: "Juntos somos mais fortes"
  buttonLink?: string;   // Opcional, rota ex: "/seguranca/dds"
  imageUrl: string;      // "/safety-helmet.webp" ou URL do storage / base64
  active: boolean;       // Visível no carrossel
  order: number;
  createdAt?: string;
  updatedAt?: string;
}

export const DEFAULT_SAFETY_BANNERS: SafetyBanner[] = [
  {
    id: 'default-safety-1',
    kicker: 'NOSSA PRIORIDADE',
    title: 'Segurança em primeiro lugar',
    description: 'Trabalhar com segurança é cuidar de você, da sua família e do nosso futuro.',
    buttonText: 'Juntos somos mais fortes',
    buttonLink: '/seguranca/dds',
    imageUrl: '/safety-helmet.webp',
    active: true,
    order: 1,
  }
];

/**
 * Detecta se uma string é uma URL externa (começa com http(s)://, www., ou domínio com extensão válida).
 */
export function isExternalUrl(link?: string | null): boolean {
  if (!link) return false;
  const trimmed = link.trim();
  if (!trimmed) return false;
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (/^www\./i.test(trimmed)) return true;
  if (/^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}(\/.*)?$/i.test(trimmed)) return true;
  return false;
}

/**
 * Resolve e normaliza o link do banner para navegação correta.
 * Retorna o link formatado e uma flag indicando se é externo.
 */
export function resolveBannerUrl(link?: string | null): { url: string; isExternal: boolean } {
  if (!link || !link.trim()) {
    return { url: '/seguranca/dds', isExternal: false };
  }
  const trimmed = link.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return { url: trimmed, isExternal: true };
  }
  if (/^www\./i.test(trimmed) || /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}(\/.*)?$/i.test(trimmed)) {
    return { url: `https://${trimmed}`, isExternal: true };
  }
  return {
    url: trimmed.startsWith('/') ? trimmed : `/${trimmed}`,
    isExternal: false
  };
}


const STORAGE_KEY = 'sucena_safety_banners';
const DB_SETTINGS_KEY = 'dashboard_safety_banners';

/**
 * Verifica se o usuário possui permissão para gerenciar os banners:
 * Apenas Técnico de Segurança, Preposto e Admin.
 */
export function canManageSafetyBanner(role?: string | null, name?: string | null): boolean {
  const r = (role || '').toLowerCase().trim();
  const n = (name || '').toLowerCase().trim();

  // Verifica admin
  try {
    if (isAdmin(n, r)) return true;
  } catch (_) {}

  if (n.includes('fabricio')) return true;

  if (r.includes('admin') && !r.includes('administrativo') && !r.includes('administracao')) {
    return true;
  }

  // Técnico de segurança / TST
  if (r.includes('seguran') || r.includes('tst') || r.includes('técnico') || r.includes('tecnico')) {
    return true;
  }

  // Preposto
  if (r.includes('preposto')) {
    return true;
  }

  return false;
}

/**
 * Retorna a lista de banners de segurança.
 * Primeiro tenta buscar do Supabase (global_settings), com fallback para localStorage e padrão.
 */
export async function getSafetyBanners(): Promise<SafetyBanner[]> {
  try {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Em background sincroniza com Supabase
            syncFromSupabase().catch(() => {});
            return parsed;
          }
        } catch (_) {}
      }
    }

    const fromDb = await fetchFromSupabase();
    if (fromDb && fromDb.length > 0) {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(fromDb));
      }
      return fromDb;
    }
  } catch (err) {
    console.warn('[SafetyBanners] Falha ao carregar do banco:', err);
  }

  return DEFAULT_SAFETY_BANNERS;
}

async function fetchFromSupabase(): Promise<SafetyBanner[] | null> {
  try {
    const { data, error } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', DB_SETTINGS_KEY)
      .maybeSingle();

    if (!error && data?.value) {
      const val = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
      if (Array.isArray(val) && val.length > 0) {
        return val;
      }
    }
  } catch (e) {
    // Tabela pode não estar criada ou sem coluna
  }
  return null;
}

async function syncFromSupabase() {
  const fromDb = await fetchFromSupabase();
  if (fromDb && fromDb.length > 0 && typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fromDb));
  }
}

/**
 * Salva a lista de banners no Supabase e atualiza o localStorage local.
 */
export async function saveSafetyBanners(banners: SafetyBanner[]): Promise<void> {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(banners));
    window.dispatchEvent(new CustomEvent('sucena_safety_banners_updated', { detail: banners }));
  }

  try {
    const { error } = await supabase
      .from('global_settings')
      .upsert({
        key: DB_SETTINGS_KEY,
        value: banners,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });

    if (error) {
      console.warn('[SafetyBanners] Upsert no Supabase retornou erro:', error.message);
    }
  } catch (err) {
    console.warn('[SafetyBanners] Falha ao persistir no Supabase:', err);
  }
}
