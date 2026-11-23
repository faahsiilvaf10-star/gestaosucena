import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_RDO_INFO_BARCARENA,
  DEFAULT_RDO_INFO_CIVIL,
  getStandardRdoHorario,
  resolveRdoHorario,
  type RdoInfoGerais
} from '../routes/relatorio-obra/rdo';
import { isFeriadoHydro, getFeriadoHydroName } from './calendarioHydro';

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

  it('horário padrão deve ser 07:00 as 16:00 na sexta e sábado, e 07:00 as 17:00 nos demais dias úteis normais', () => {
    // 2026-11-15: Domingo (day 0) - observação: 15/11 é feriado Proclamação da República
    expect(isFeriadoHydro('2026-11-15')).toBe(true);
    expect(getStandardRdoHorario('2026-11-15')).toBe('07:00 as 16:00');

    // 2026-11-16: Segunda-feira (dia útil normal)
    expect(isFeriadoHydro('2026-11-16')).toBe(false);
    expect(getStandardRdoHorario('2026-11-16')).toBe('07:00 as 17:00');

    // 2026-11-17: Terça-feira (dia útil normal)
    expect(isFeriadoHydro('2026-11-17')).toBe(false);
    expect(getStandardRdoHorario('2026-11-17')).toBe('07:00 as 17:00');

    // 2026-11-18: Quarta-feira (dia útil normal)
    expect(isFeriadoHydro('2026-11-18')).toBe(false);
    expect(getStandardRdoHorario('2026-11-18')).toBe('07:00 as 17:00');

    // 2026-11-19: Quinta-feira (dia útil normal)
    expect(isFeriadoHydro('2026-11-19')).toBe(false);
    expect(getStandardRdoHorario('2026-11-19')).toBe('07:00 as 17:00');

    // 2026-11-20: Sexta-feira
    expect(getStandardRdoHorario('2026-11-20')).toBe('07:00 as 16:00');

    // 2026-11-21: Sábado
    expect(getStandardRdoHorario('2026-11-21')).toBe('07:00 as 16:00');
  });

  it('feriados conforme o Calendário Hydro devem ser sempre 07:00 as 16:00 mesmo caindo em dia de semana', () => {
    // 2026-04-21: Terça-feira (Tiradentes)
    expect(isFeriadoHydro('2026-04-21')).toBe(true);
    expect(getFeriadoHydroName('2026-04-21')).toBe('Tiradentes');
    expect(getStandardRdoHorario('2026-04-21')).toBe('07:00 as 16:00');
    expect(resolveRdoHorario('2026-04-21', '07:00 as 17:00')).toBe('07:00 as 16:00');

    // 2026-09-07: Segunda-feira (Independência do Brasil)
    expect(isFeriadoHydro('2026-09-07')).toBe(true);
    expect(getStandardRdoHorario('2026-09-07')).toBe('07:00 as 16:00');

    // 2026-12-03: Quinta-feira (Feriado Municipal - São Francisco Xavier)
    expect(isFeriadoHydro('2026-12-03')).toBe(true);
    expect(getStandardRdoHorario('2026-12-03')).toBe('07:00 as 16:00');
  });

  it('resolveRdoHorario deve forçar 07:00 as 17:00 em dias úteis normais mesmo se salvo com 07:00 as 16:00', () => {
    // Terça-feira (17/11/2026) normal -> 07:00 as 17:00
    expect(resolveRdoHorario('2026-11-17', '07:00 as 16:00')).toBe('07:00 as 17:00');
    expect(resolveRdoHorario('2026-11-17', '07:00 às 16:00')).toBe('07:00 as 17:00');

    // Sexta-feira e Sábado devem forçar 16:00 mesmo se salvo com 17:00
    expect(resolveRdoHorario('2026-11-20', '07:00 as 17:00')).toBe('07:00 as 16:00');
    expect(resolveRdoHorario('2026-11-21', '07:00 as 17:00')).toBe('07:00 as 16:00');

    // Horários customizados de exceção devem ser preservados
    expect(resolveRdoHorario('2026-11-17', '08:00 as 12:00')).toBe('08:00 as 12:00');
  });
});
