export interface CustomRdoItem {
  id: string;
  nome: string;
  tipo: 'checkbox' | 'medicao';
  marcado?: boolean;
  valor?: string;
  unidade?: string;
  faixa?: string;
  berma?: string;
  detalhe?: string;
}

export interface CustomRdoModulo {
  id: string;
  name: string;
  icon: string;
  desc?: string;
  defaultItens: CustomRdoItem[];
  created_at: string;
  created_by?: string;
}

export interface CustomRdoDailyData {
  moduloId: string;
  moduloName?: string;
  data: string;
  localFaixa?: string;
  localElevado?: string;
  itens: CustomRdoItem[];
  observacoes?: string;
  isLocked?: boolean;
  updated_at?: string;
}
