export type CustomModelType = 'medicao' | 'selecao' | 'checkbox' | 'texto_livre';

export interface CustomCardModel {
  id: string;
  tipo: CustomModelType;
  titulo: string;
  unidade?: string;
  opcoes?: string[];
  labelOpcao?: string;
  containerClassName?: string;
}

export interface CustomCardRowData {
  id?: string;
  value?: string;
  faixa?: string;
  berma?: string;
  opcao?: string;
}

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
  models?: CustomCardModel[];
  temOutrasAtividades?: boolean;
  defaultItens?: CustomRdoItem[];
  created_at: string;
  created_by?: string;
}

export interface CustomRdoDailyData {
  moduloId: string;
  moduloName?: string;
  data: string;
  renderedSummary?: string;
  cardRows?: Record<string, CustomCardRowData[]>;
  cardCheckboxes?: Record<string, boolean>;
  outrasAtividades?: {
    faixa?: string;
    berma?: string;
    descricao?: string;
  };
  localFaixa?: string;
  localElevado?: string;
  itens?: CustomRdoItem[];
  observacoes?: string;
  isLocked?: boolean;
  updated_at?: string;
}
