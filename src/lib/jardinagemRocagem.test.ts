import { describe, it, expect } from 'vitest';
import {
  getRocagemCycleForDate,
  calculatePeriodActivityTotal,
  parseNumber,
  formatM2,
  JARDINAGEM_ACTIVITIES,
  RocagemEntry
} from './jardinagemRocagem';

describe('jardinagemRocagem - Ciclos Contratuais e Cálculos', () => {
  it('deve calcular corretamente o ciclo para datas a partir do dia 16', () => {
    // 16/10/2026 deve pertencer ao ciclo de 16/10/2026 a 15/11/2026
    const cycle = getRocagemCycleForDate('2026-10-16');
    expect(cycle.startDate).toBe('2026-10-16');
    expect(cycle.endDate).toBe('2026-11-15');
    expect(cycle.label).toBe('16/10/2026 a 15/11/2026');
  });

  it('deve calcular corretamente o ciclo para datas até o dia 15', () => {
    // 05/11/2026 deve pertencer ao ciclo de 16/10/2026 a 15/11/2026
    const cycle = getRocagemCycleForDate('2026-11-05');
    expect(cycle.startDate).toBe('2026-10-16');
    expect(cycle.endDate).toBe('2026-11-15');
  });

  it('deve calcular corretamente a transição de ano (dezembro para janeiro)', () => {
    const cycleDec = getRocagemCycleForDate('2026-12-20');
    expect(cycleDec.startDate).toBe('2026-12-16');
    expect(cycleDec.endDate).toBe('2027-01-15');

    const cycleJan = getRocagemCycleForDate('2027-01-10');
    expect(cycleJan.startDate).toBe('2026-12-16');
    expect(cycleJan.endDate).toBe('2027-01-15');
  });

  it('parseNumber e formatM2 devem formatar valores brasileiros corretamente', () => {
    expect(parseNumber('1.250,50')).toBe(1250.5);
    expect(parseNumber('500')).toBe(500);
    expect(parseNumber('0')).toBe(0);
    expect(parseNumber('')).toBe(0);
    expect(formatM2(1250.5)).toBe('1.250,5');
  });

  it('calculatePeriodActivityTotal deve acumular roçagem no ciclo incluindo dia atual', () => {
    const savedRecords: RocagemEntry[] = [
      { date: '2026-10-20', faixa: 'Faixa 1', berma: 'Berma 28', value: 1000, rawString: '1000' },
      { date: '2026-10-25', faixa: 'Faixa 2', berma: 'Berma 30', value: 500, rawString: '500' },
      // Registro fora do ciclo
      { date: '2026-09-10', faixa: 'Faixa 1', berma: 'Berma 28', value: 9999, rawString: '9999' }
    ];

    const currentDayRows = [
      { faixa: 'Faixa 3', berma: 'Berma 32', value: '250' }
    ];

    const result = calculatePeriodActivityTotal('2026-11-03', savedRecords, currentDayRows);
    expect(result.otherDaysM2).toBe(1500);
    expect(result.currentDayM2).toBe(250);
    expect(result.totalM2).toBe(1750);
  });

  it('calculatePeriodActivityTotal deve funcionar identicamente para Limpeza Manual e Soprador', () => {
    const manualRecords: RocagemEntry[] = [
      { activityType: 'limpeza_manual', date: '2026-10-18', faixa: 'Faixa 1', berma: 'Berma 26', value: 800, rawString: '800' },
      { activityType: 'limpeza_manual', date: '2026-10-22', faixa: 'Faixa 2', berma: 'Berma 28', value: 1200, rawString: '1200' }
    ];

    const manualResult = calculatePeriodActivityTotal('2026-10-25', manualRecords, [{ faixa: 'Faixa 1', berma: 'Berma 30', value: '300' }]);
    expect(manualResult.totalM2).toBe(2300);

    const sopradorRecords: RocagemEntry[] = [
      { activityType: 'limpeza_soprador', date: '2026-10-18', faixa: 'Faixa 1', berma: 'Berma 26', value: 500, rawString: '500' },
      { activityType: 'limpeza_soprador', date: '2026-10-22', faixa: 'Faixa 2', berma: 'Berma 28', value: 700, rawString: '700' }
    ];

    const sopradorResult = calculatePeriodActivityTotal('2026-10-25', sopradorRecords, [{ faixa: 'Faixa 1', berma: 'Berma 30', value: '400' }]);
    expect(sopradorResult.totalM2).toBe(1600);
  });

  it('deve ter as 3 atividades configuradas com nomes e unidades corretas', () => {
    expect(JARDINAGEM_ACTIVITIES.rocagem.name).toBe('Roçagem');
    expect(JARDINAGEM_ACTIVITIES.limpeza_manual.name).toBe('Limpeza Manual');
    expect(JARDINAGEM_ACTIVITIES.limpeza_soprador.name).toBe('Limpeza com Soprador');
    expect(JARDINAGEM_ACTIVITIES.limpeza_manual.unit).toBe('m²');
    expect(JARDINAGEM_ACTIVITIES.limpeza_soprador.unit).toBe('m²');
  });
});
