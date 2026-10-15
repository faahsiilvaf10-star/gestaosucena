-- Migration: Move existing aso_admissional_2 values to aso_admissional and clear aso_admissional_2 in rh_efetivo
UPDATE public.rh_efetivo
SET 
  aso_admissional = COALESCE(aso_admissional, aso_admissional_2),
  aso_admissional_2 = NULL
WHERE aso_admissional_2 IS NOT NULL;
