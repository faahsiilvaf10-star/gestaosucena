import { describe, it, expect } from 'vitest';

describe('Atividades RDO Gabião e Jardinagem - Elevado e Berma', () => {
  const bermas = [
    ...Array.from({length: 32}, (_, i) => {
      const num = i + 26;
      return num % 2 === 0 ? `Berma ${num}` : `Elevado ${num}`;
    }),
    'MIRANTE',
    'GABIÃO 1',
    'GABIÃO 2',
    'GABIÃO 3'
  ];

  it('deve conter 32 itens numerados de 26 a 57 mais os locais especiais', () => {
    expect(bermas.length).toBe(32 + 4);
    expect(bermas).toContain('Berma 26');
    expect(bermas).toContain('Elevado 27');
    expect(bermas).toContain('Berma 56');
    expect(bermas).toContain('Elevado 57');
    expect(bermas).toContain('MIRANTE');
    expect(bermas).toContain('GABIÃO 1');
    expect(bermas).toContain('GABIÃO 2');
    expect(bermas).toContain('GABIÃO 3');
  });

  it('todos os números pares devem ser Berma e ímpares devem ser Elevado', () => {
    for (let n = 26; n <= 57; n++) {
      if (n % 2 === 0) {
        expect(bermas).toContain(`Berma ${n}`);
        expect(bermas).not.toContain(`Elevado ${n}`);
      } else {
        expect(bermas).toContain(`Elevado ${n}`);
        expect(bermas).not.toContain(`Berma ${n}`);
      }
    }
  });

  it('normalizador deve converter formatos legados corretamente', () => {
    const normalize = (val: string) => {
      if (!val || val === 'Nenhum') return val;
      const match = val.match(/^(?:Berma|Elevado)?\s*(\d+)$/i);
      if (match) {
        const n = parseInt(match[1], 10);
        return n % 2 === 0 ? `Berma ${n}` : `Elevado ${n}`;
      }
      return val;
    };

    expect(normalize('Berma 41')).toBe('Elevado 41');
    expect(normalize('Berma 42')).toBe('Berma 42');
    expect(normalize('41')).toBe('Elevado 41');
    expect(normalize('56')).toBe('Berma 56');
    expect(normalize('57')).toBe('Elevado 57');
    expect(normalize('MIRANTE')).toBe('MIRANTE');
    expect(normalize('GABIÃO 1')).toBe('GABIÃO 1');
  });
});
