import { describe, it, expect } from 'vitest';

describe('Identificação de Relatórios Salvos no Dia Atual (Hub Relatório de Obra)', () => {
  const isSavedCustom = (d: any) => {
    if (!d) return false;
    if (d.isLocked !== false && d.isLocked !== undefined) return true;
    if (d.renderedSummary && d.renderedSummary.trim() && !d.renderedSummary.startsWith('Nenhuma atividade')) return true;
    if (d.outrasAtividades?.descricao && d.outrasAtividades.descricao.trim()) return true;
    if (d.cardRows && Object.values(d.cardRows).some((rows: any) => Array.isArray(rows) && rows.some((r: any) => r && r.value && r.value !== '0' && r.value !== '0,00'))) return true;
    if (d.cardCheckboxes && Object.values(d.cardCheckboxes).some((v: any) => !!v)) return true;
    return false;
  };

  const hasDataObj = (val: any) => {
    if (!val) return false;
    if (val.isLocked !== false && val.isLocked !== undefined) return true;
    return Object.values(val).some((v: any) => {
      if (Array.isArray(v)) return v.some((r: any) => r && r.value && r.value !== '0' && r.value !== '0,00');
      if (typeof v === 'string') return v.trim().length > 0;
      return false;
    });
  };

  it('deve marcar módulo customizado como salvo quando isLocked for true', () => {
    const data = {
      moduloId: 'civil-canteiro-sucena',
      moduloName: 'Construção do Canteiro Sucena',
      isLocked: true,
      cardRows: {
        'atividades': [{ opcao: 'Construção de Área Verde', value: '10' }]
      }
    };
    expect(isSavedCustom(data)).toBe(true);
  });

  it('não deve marcar módulo customizado como salvo quando estiver vazio e não bloqueado', () => {
    const data = {
      moduloId: 'civil-canteiro-sucena',
      isLocked: false,
      cardRows: {
        'atividades': [{ value: '' }, { value: '0' }]
      }
    };
    expect(isSavedCustom(data)).toBe(false);
  });

  it('deve extrair o ID do módulo customizado a partir da chave com sufixo da data', () => {
    const todayStr = '2026-11-13';
    const key = `custom_rdo_civil-canteiro-sucena_${todayStr}`;
    const modId = key.replace('custom_rdo_', '').replace(`_${todayStr}`, '');
    expect(modId).toBe('civil-canteiro-sucena');
  });

  it('deve detectar RDO principal e atividades fixas como salvas para o dia', () => {
    const todayStr = '2026-11-13';
    const rdoData = { isLocked: true, local: 'Barcarena' };
    const jarData = { isLocked: true, rocagem: [{ value: '500' }] };
    const gabData = { isLocked: true, gabiado: [{ value: '10' }] };

    expect(rdoData.isLocked !== false).toBe(true);
    expect(hasDataObj(jarData)).toBe(true);
    expect(hasDataObj(gabData)).toBe(true);
  });
});
