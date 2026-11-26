import { describe, it, expect } from 'vitest';
import {
  BERMAS_OPTIONS,
  ELEVADOS_OPTIONS,
  normalizeBermaElevado,
  splitBermaElevado,
  formatBermaElevadoPair,
  formatRdoLocation,
} from './rdoLocations';

describe('Atividades RDO Gabião, Jardinagem, Módulos e RDO Principal - Berma e Elevado separados', () => {
  it('deve separar corretamente Bermas (pares + locais especiais) de Elevados (ímpares)', () => {
    expect(BERMAS_OPTIONS.length).toBe(16 + 4);
    expect(ELEVADOS_OPTIONS.length).toBe(16);

    for (let n = 26; n <= 57; n++) {
      if (n % 2 === 0) {
        expect(BERMAS_OPTIONS).toContain(`Berma ${n}`);
        expect(ELEVADOS_OPTIONS).not.toContain(`Berma ${n}`);
        expect(ELEVADOS_OPTIONS).not.toContain(`Elevado ${n}`);
      } else {
        expect(ELEVADOS_OPTIONS).toContain(`Elevado ${n}`);
        expect(BERMAS_OPTIONS).not.toContain(`Elevado ${n}`);
        expect(BERMAS_OPTIONS).not.toContain(`Berma ${n}`);
      }
    }

    expect(BERMAS_OPTIONS).toContain('MIRANTE');
    expect(BERMAS_OPTIONS).toContain('GABIÃO 1');
    expect(BERMAS_OPTIONS).toContain('GABIÃO 2');
    expect(BERMAS_OPTIONS).toContain('GABIÃO 3');
  });

  it('normalizador deve converter formatos legados corretamente', () => {
    expect(normalizeBermaElevado('Berma 41')).toBe('Elevado 41');
    expect(normalizeBermaElevado('Berma 42')).toBe('Berma 42');
    expect(normalizeBermaElevado('41')).toBe('Elevado 41');
    expect(normalizeBermaElevado('56')).toBe('Berma 56');
    expect(normalizeBermaElevado('57')).toBe('Elevado 57');
    expect(normalizeBermaElevado('MIRANTE')).toBe('MIRANTE');
    expect(normalizeBermaElevado('GABIÃO 1')).toBe('GABIÃO 1');
    expect(normalizeBermaElevado('Nenhum')).toBe('');
    expect(normalizeBermaElevado('Nenhuma')).toBe('');
  });

  it('splitBermaElevado deve suportar Berma e Elevado juntos, isolados e registros legados', () => {
    // Ambos preenchidos (caso da imagem: Berma 36 + Elevado 37)
    expect(splitBermaElevado('Berma 36', 'Elevado 37')).toEqual({
      berma: 'Berma 36',
      elevado: 'Elevado 37',
    });

    // Somente Berma
    expect(splitBermaElevado('Berma 36', '')).toEqual({
      berma: 'Berma 36',
      elevado: '',
    });

    // Somente Elevado (novo campo)
    expect(splitBermaElevado('', 'Elevado 37')).toEqual({
      berma: '',
      elevado: 'Elevado 37',
    });

    // Legado Jardinagem/Módulo onde Elevado ficava salvo dentro do campo berma
    expect(splitBermaElevado('Elevado 37', undefined)).toEqual({
      berma: '',
      elevado: 'Elevado 37',
    });
    expect(splitBermaElevado('Berma 41', undefined)).toEqual({
      berma: '',
      elevado: 'Elevado 41',
    });

    // Legado Gabião onde Berma/MIRANTE ficava salvo dentro de localElevado
    expect(splitBermaElevado(undefined, 'Berma 36')).toEqual({
      berma: 'Berma 36',
      elevado: '',
    });
    expect(splitBermaElevado(undefined, 'MIRANTE')).toEqual({
      berma: 'MIRANTE',
      elevado: '',
    });

    // Nenhum selecionado
    expect(splitBermaElevado('Nenhuma', 'Nenhum')).toEqual({
      berma: '',
      elevado: '',
    });
  });

  it('formatBermaElevadoPair e formatRdoLocation devem formatar para atividades e RDO principal', () => {
    expect(formatBermaElevadoPair('Berma 36', 'Elevado 37')).toBe('Berma 36 e Elevado 37');
    expect(formatBermaElevadoPair('Berma 36', '')).toBe('Berma 36');
    expect(formatBermaElevadoPair('', 'Elevado 37')).toBe('Elevado 37');

    expect(formatRdoLocation('Faixa 5', 'Berma 36', 'Elevado 37')).toBe(
      'Faixa 5 Berma 36 e Elevado 37'
    );
    expect(formatRdoLocation('Faixa 5', 'Berma 36', '')).toBe('Faixa 5 Berma 36');
    expect(formatRdoLocation('Faixa 5', '', 'Elevado 37')).toBe('Faixa 5 Elevado 37');
    expect(formatRdoLocation('', 'Berma 36', 'Elevado 37')).toBe('Berma 36 e Elevado 37');
    expect(formatRdoLocation('Faixa 5', '', '')).toBe('Faixa 5');
  });

  it('máscara de contagem em m² deve ser inteira com ponto e sem vírgula, igual roçagem', () => {
    const maskNumber = (val: string, isFloat = false) => {
      if (!isFloat) {
        val = val.split(',')[0];
      }
      let raw = val.replace(/\D/g, '');
      if (!raw) return '';
      if (isFloat) {
        while (raw.length < 3) raw = '0' + raw;
        const intPart = raw.slice(0, -2).replace(/^0+/, '') || '0';
        const decPart = raw.slice(-2);
        return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + ',' + decPart;
      } else {
        const intPart = raw.replace(/^0+/, '') || '0';
        return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
      }
    };

    // Sem isFloat (padrão de roçagem, limpeza manual, limpeza soprador e plantio de grama)
    expect(maskNumber('0')).toBe('0');
    expect(maskNumber('0,00')).toBe('0');
    expect(maskNumber('100,00')).toBe('100');
    expect(maskNumber('500')).toBe('500');
    expect(maskNumber('1000')).toBe('1.000');
    expect(maskNumber('15000')).toBe('15.000');
    expect(maskNumber('1234567')).toBe('1.234.567');
  });
});
