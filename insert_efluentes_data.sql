-- Script para inserir dados de Efluentes Sanitários da tabela fornecida na imagem
-- Foi considerado o ano de 2026.

INSERT INTO public.efluentes_registros 
(data_registro, volume_m3) 
VALUES
('2026-01', 13.125),
('2026-02', 6.651),
('2026-03', 15.182),
('2026-04', 10.253),
('2026-05', 11.625),
('2026-06', 17.132),
('2026-07', 18.235),
('2026-08', 12.411)
ON CONFLICT (data_registro) DO UPDATE SET 
  volume_m3 = EXCLUDED.volume_m3;
