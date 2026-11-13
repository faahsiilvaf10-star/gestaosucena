import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_RDO_INFO_BARCARENA,
  DEFAULT_RDO_INFO_CIVIL,
  type RdoInfoGerais
} from '../routes/relatorio-obra/rdo';

describe('RDO - Informações Gerais Isoladas por Ambiente', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('deve possuir configurações padrão distintas para Barcarena e Hydro Civil', () => {
    expect(DEFAULT_RDO_INFO_BARCARENA.local).toBe('Alunorte Barcarena');
    expect(DEFAULT_RDO_INFO_CIVIL.local).toBe('Hydro Civil');
    expect(DEFAULT_RDO_INFO_BARCARENA.empresa).toBe('Sucena Empreendimentos');
    expect(DEFAULT_RDO_INFO_CIVIL.empresa).toBe('Sucena Empreendimentos');
    expect(DEFAULT_RDO_INFO_CIVIL.contrato).toBe('4600013715');
    expect(DEFAULT_RDO_INFO_BARCARENA.contrato).toBe('460001269');
  });

  it('salvar Informações Gerais em um ambiente não deve afetar o outro', () => {
    const customBarcarena: RdoInfoGerais = {
      empresa: 'Sucena Barcarena',
      contrato: '111111111',
      gerencia: 'Hydro Reabilitação',
      lideranca: 'Líder Barcarena',
      tst: 'TST Barcarena',
      local: 'Alunorte Barcarena',
      horario: '07:00 as 17:00'
    };

    const customCivil: RdoInfoGerais = {
      empresa: 'Sucena Civil',
      contrato: '222222222',
      gerencia: 'Hydro Civil Gerência',
      lideranca: 'Eng. Civil Responsável',
      tst: 'TST Civil',
      local: 'Canteiro Avançado Hydro',
      horario: '07:00 as 16:00'
    };

    localStorage.setItem('rdo_info_gerais_barcarena', JSON.stringify(customBarcarena));
    localStorage.setItem('rdo_info_gerais_hydro-civil', JSON.stringify(customCivil));

    const loadedBarcarena = JSON.parse(localStorage.getItem('rdo_info_gerais_barcarena') || '{}');
    const loadedCivil = JSON.parse(localStorage.getItem('rdo_info_gerais_hydro-civil') || '{}');

    expect(loadedBarcarena.contrato).toBe('111111111');
    expect(loadedBarcarena.local).toBe('Alunorte Barcarena');
    expect(loadedBarcarena.lideranca).toBe('Líder Barcarena');

    expect(loadedCivil.contrato).toBe('222222222');
    expect(loadedCivil.local).toBe('Canteiro Avançado Hydro');
    expect(loadedCivil.lideranca).toBe('Eng. Civil Responsável');
    expect(loadedCivil.horario).toBe('07:00 as 16:00');
  });
});
