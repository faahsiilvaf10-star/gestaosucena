import { describe, it, expect } from 'vitest';
import { CIVIL_AREAS_DEFINITIONS } from './civilAreasData';
import type { CustomRdoDailyData } from '../types/rdoCustomModule';

describe('Isolamento de Módulos RDO entre Hydro Civil e Reabilitação', () => {
  const civilDefIds = new Set(CIVIL_AREAS_DEFINITIONS.map(a => a.id));

  const isItemCivil = (
    d: CustomRdoDailyData,
    storageKey?: string,
    civilCustomIds: Set<string> = new Set()
  ): boolean => {
    if (d.environment === 'hydro-civil') return true;
    if (d.environment === 'barcarena') return false;
    if (d.moduloId && (d.moduloId.startsWith('civil-') || civilDefIds.has(d.moduloId) || civilCustomIds.has(d.moduloId))) return true;
    if (storageKey && (storageKey.includes('civil-') || storageKey.includes('_hydro-civil_'))) return true;
    const name = (d.moduloName || '').trim().toLowerCase();
    if (name.includes('canteiro') && name.includes('sucena')) return true;
    if (name.includes('canteiro') && name.includes('hydro')) return true;
    if (CIVIL_AREAS_DEFINITIONS.some(c => c.name.toLowerCase() === name)) return true;
    return false;
  };

  it('deve identificar Construção do Canteiro Sucena como módulo do ambiente Civil', () => {
    const canteiroSucena: CustomRdoDailyData = {
      moduloId: 'civil-canteiro-sucena',
      moduloName: 'Construção do Canteiro Sucena',
      data: '2026-11-13',
      cardRows: {
        'civil-canteiro-sucena-atividades': [
          { opcao: 'Construção de Área Verde', value: '10', unidade: 'm²' },
          { opcao: 'Identificação de Riscos', value: '10', unidade: 'unid' },
        ],
      },
    };

    expect(isItemCivil(canteiroSucena, 'custom_rdo_civil-canteiro-sucena_2026-11-13')).toBe(true);
  });

  it('deve bloquear exibição de Construção do Canteiro Sucena no RDO de Reabilitação', () => {
    const isCivilEnv = false; // Reabilitação (Barcarena)
    const items: Array<{ key: string; data: CustomRdoDailyData }> = [
      {
        key: 'custom_rdo_civil-canteiro-sucena_2026-11-13',
        data: {
          moduloId: 'civil-canteiro-sucena',
          moduloName: 'Construção do Canteiro Sucena',
          data: '2026-11-13',
        },
      },
      {
        key: 'custom_rdo_mod-reabilitacao-1_2026-11-13',
        data: {
          moduloId: 'mod-reabilitacao-1',
          moduloName: 'Atividade Exclusiva Reabilitação',
          environment: 'barcarena',
          data: '2026-11-13',
        },
      },
    ];

    const filtered = items.filter(item => {
      const isCivil = isItemCivil(item.data, item.key);
      return isCivilEnv ? isCivil : !isCivil;
    });

    expect(filtered.length).toBe(1);
    expect(filtered[0].data.moduloName).toBe('Atividade Exclusiva Reabilitação');
    expect(filtered.some(i => i.data.moduloId === 'civil-canteiro-sucena')).toBe(false);
  });

  it('deve permitir Construção do Canteiro Sucena e áreas civis no RDO do Hydro Civil', () => {
    const isCivilEnv = true; // Hydro Civil
    const items: Array<{ key: string; data: CustomRdoDailyData }> = [
      {
        key: 'custom_rdo_civil-canteiro-sucena_2026-11-13',
        data: {
          moduloId: 'civil-canteiro-sucena',
          moduloName: 'Construção do Canteiro Sucena',
          data: '2026-11-13',
        },
      },
      {
        key: 'custom_rdo_civil-canteiro-hydro_2026-11-13',
        data: {
          moduloId: 'civil-canteiro-hydro',
          moduloName: 'Canteiro Avançado - HYDRO',
          data: '2026-11-13',
        },
      },
      {
        key: 'custom_rdo_mod-reab_2026-11-13',
        data: {
          moduloId: 'mod-reab',
          moduloName: 'Atividade da Reabilitação',
          environment: 'barcarena',
          data: '2026-11-13',
        },
      },
    ];

    const filtered = items.filter(item => {
      const isCivil = isItemCivil(item.data, item.key);
      return isCivilEnv ? isCivil : !isCivil;
    });

    expect(filtered.length).toBe(2);
    expect(filtered.map(i => i.data.moduloId)).toEqual([
      'civil-canteiro-sucena',
      'civil-canteiro-hydro',
    ]);
  });
});
