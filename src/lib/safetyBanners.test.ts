import { describe, it, expect } from 'vitest';
import { canManageSafetyBanner, DEFAULT_SAFETY_BANNERS } from './safetyBanners';

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

