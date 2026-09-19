-- Script para inserir dados de Resíduos Sólidos da tabela fornecida na imagem
-- Foi considerado o ano de 2026.

INSERT INTO public.residuos_registros 
(data_registro, papel_kg, plastico_kg, nao_reciclavel_kg, metal_kg, organico_kg) 
VALUES
('2026-01', 8.97, 18.15, 8.53, 6.76, 5.23),
('2026-02', 10.2, 18, 20.04, 37.3, 5.2),
('2026-03', 8.4, 14, 13, 10, 6),
('2026-04', 4.52, 3.27, 6.31, 6.32, 3.2),
('2026-05', 6.32, 5.65, 12.56, 25.6, 2.8),
('2026-06', 7.56, 6, 9.56, 14, 5.21),
('2026-07', 6.35, 7.25, 11.32, 15.35, 6.8),
('2026-08', 5.65, 6.21, 4.93, 75.21, 4.25)
ON CONFLICT (data_registro) DO UPDATE SET 
  papel_kg = EXCLUDED.papel_kg,
  plastico_kg = EXCLUDED.plastico_kg,
  nao_reciclavel_kg = EXCLUDED.nao_reciclavel_kg,
  metal_kg = EXCLUDED.metal_kg,
  organico_kg = EXCLUDED.organico_kg;
