import { describe, it, expect } from 'vitest';
import {
  canManageSafetyBanner,
  DEFAULT_SAFETY_BANNERS,
  isExternalUrl,
  resolveBannerUrl
} from './safetyBanners';

describe('canManageSafetyBanner', () => {
  it('deve permitir administradores', () => {
    expect(canManageSafetyBanner('admin', 'Qualquer')).toBe(true);
    expect(canManageSafetyBanner('Administrador', 'João')).toBe(true);
    expect(canManageSafetyBanner('user', 'Fabricio')).toBe(true); // admin reconhecido por nome
  });

  it('deve permitir Técnicos de Segurança / TST', () => {
    expect(canManageSafetyBanner('Técnico de Segurança', 'Carlos')).toBe(true);
    expect(canManageSafetyBanner('tecnico de seguranca', 'Maria')).toBe(true);
    expect(canManageSafetyBanner('TST', 'Pedro')).toBe(true);
    expect(canManageSafetyBanner('Engenheiro de Segurança', 'Ana')).toBe(true);
  });

  it('deve permitir Preposto', () => {
    expect(canManageSafetyBanner('Preposto', 'Lucas')).toBe(true);
    expect(canManageSafetyBanner('preposto operacional', 'Marcos')).toBe(true);
  });

  it('deve bloquear outros cargos não autorizados', () => {
    expect(canManageSafetyBanner('Motorista', 'José')).toBe(false);
    expect(canManageSafetyBanner('Operador', 'Antônio')).toBe(false);
    expect(canManageSafetyBanner('Visitante', 'Visitante')).toBe(false);
    expect(canManageSafetyBanner('', '')).toBe(false);
    expect(canManageSafetyBanner(undefined, null)).toBe(false);
  });

  it('deve conter o banner padrão com tempo e campos corretos', () => {
    expect(DEFAULT_SAFETY_BANNERS.length).toBeGreaterThan(0);
    const first = DEFAULT_SAFETY_BANNERS[0];
    expect(first.kicker).toBe('NOSSA PRIORIDADE');
    expect(first.title).toBe('Segurança em primeiro lugar');
    expect(first.imageUrl).toBe('/safety-helmet.webp');
    expect(first.active).toBe(true);
  });
});

describe('isExternalUrl e resolveBannerUrl', () => {
  it('deve reconhecer links com https:// e http:// como externos', () => {
    expect(isExternalUrl('https://site.com.br')).toBe(true);
    expect(isExternalUrl('http://empresa.com/pagina')).toBe(true);
    expect(resolveBannerUrl('https://site.com.br')).toEqual({
      url: 'https://site.com.br',
      isExternal: true
    });
  });

  it('deve reconhecer links começando com www. e adicionar https:// automaticamente', () => {
    expect(isExternalUrl('www.google.com')).toBe(true);
    expect(resolveBannerUrl('www.google.com')).toEqual({
      url: 'https://www.google.com',
      isExternal: true
    });
  });

  it('deve reconhecer domínios válidos sem protocolo e adicionar https://', () => {
    expect(isExternalUrl('intranet.sucena.com.br')).toBe(true);
    expect(resolveBannerUrl('intranet.sucena.com.br/seguranca')).toEqual({
      url: 'https://intranet.sucena.com.br/seguranca',
      isExternal: true
    });
  });

  it('deve tratar rotas internas do sistema preservando a barra inicial', () => {
    expect(isExternalUrl('/seguranca/dds')).toBe(false);
    expect(resolveBannerUrl('/seguranca/dds')).toEqual({
      url: '/seguranca/dds',
      isExternal: false
    });
    expect(isExternalUrl('estoque')).toBe(false);
    expect(resolveBannerUrl('estoque')).toEqual({
      url: '/estoque',
      isExternal: false
    });
  });

  it('deve usar rota padrão /seguranca/dds quando o link estiver vazio ou nulo', () => {
    expect(isExternalUrl('')).toBe(false);
    expect(isExternalUrl(null)).toBe(false);
    expect(resolveBannerUrl('')).toEqual({
      url: '/seguranca/dds',
      isExternal: false
    });
    expect(resolveBannerUrl(undefined)).toEqual({
      url: '/seguranca/dds',
      isExternal: false
    });
  });
});
