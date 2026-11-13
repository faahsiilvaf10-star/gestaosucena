import { describe, it, expect } from 'vitest';

describe('Identificação de Relatórios Salvos no Dia Atual (Hub Relatório de Obra)', () => {
  const isSavedCustom = (d: any) => {
    if (!d) return false;
    if (d.isLocked === false) return false;
    if (d.isLocked === true) return true;
    return false;
  };

  const isSavedFixed = (val: any) => {
    if (!val) return false;
    return val.isLocked === true;
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

  it('não deve marcar módulo customizado como salvo quando estiver desbloqueado (isLocked === false), mesmo com dados preenchidos', () => {
    const data = {
      moduloId: 'civil-canteiro-sucena',
      moduloName: 'Construção do Canteiro Sucena',
      isLocked: false,
      cardRows: {
        'atividades': [{ opcao: 'Construção de Área Verde', value: '10' }]
      },
      renderedSummary: '* Construção de Área Verde: 10 m²'
    };
    expect(isSavedCustom(data)).toBe(false);
  });

  it('não deve marcar relatórios fixos como salvos quando estiverem desbloqueados (isLocked === false)', () => {
    const rdoUnlocked = { isLocked: false, local: 'Barcarena' };
    const jarUnlocked = { isLocked: false, rocagem: [{ value: '500' }] };
    const gabUnlocked = { isLocked: false, gabiado: [{ value: '10' }] };

    expect(isSavedFixed(rdoUnlocked)).toBe(false);
    expect(isSavedFixed(jarUnlocked)).toBe(false);
    expect(isSavedFixed(gabUnlocked)).toBe(false);
  });

  it('deve marcar relatórios fixos como salvos apenas quando isLocked for true', () => {
    const rdoData = { isLocked: true, local: 'Barcarena' };
    const jarData = { isLocked: true, rocagem: [{ value: '500' }] };
    const gabData = { isLocked: true, gabiado: [{ value: '10' }] };

    expect(isSavedFixed(rdoData)).toBe(true);
    expect(isSavedFixed(jarData)).toBe(true);
    expect(isSavedFixed(gabData)).toBe(true);
  });

  it('deve extrair o ID do módulo customizado a partir da chave com sufixo da data', () => {
    const todayStr = '2026-11-13';
    const key = `custom_rdo_civil-canteiro-sucena_${todayStr}`;
    const modId = key.replace('custom_rdo_', '').replace(`_${todayStr}`, '');
    expect(modId).toBe('civil-canteiro-sucena');
  });
});
