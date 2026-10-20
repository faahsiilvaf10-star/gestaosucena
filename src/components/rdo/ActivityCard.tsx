import { useState } from 'react';
import * as Icons from 'lucide-react';
import { CheckCircle2, Circle, Pencil, Trash2, ChevronDown, ChevronUp, Layers, CheckSquare, Square } from 'lucide-react';

export interface SubAtividadeItem {
  id: string;
  nome: string;
  tipo: 'checkbox' | 'medicao';
  marcado: boolean;
  valor?: string;
  unidade?: string;
  faixa?: string;
  berma?: string;
  detalhe?: string;
}

export interface RdoAtividade {
  id: string;
  obra_id?: string;
  data: string;
  titulo: string;
  icon: string;
  area?: string;
  quantidade?: number;
  metragem?: number;
  unidade?: string;
  descricao?: string;
  observacoes?: string;
  itens?: SubAtividadeItem[];
  concluido: boolean;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
}

export function getSubItens(atividade: RdoAtividade): SubAtividadeItem[] {
  if (atividade.itens && Array.isArray(atividade.itens)) {
    return atividade.itens;
  }
  if (atividade.observacoes && typeof atividade.observacoes === 'string') {
    if (atividade.observacoes.startsWith('__ITEMS__:')) {
      try {
        return JSON.parse(atividade.observacoes.replace('__ITEMS__:', ''));
      } catch (e) {
        console.warn('Erro ao decodificar itens:', e);
      }
    } else if (atividade.observacoes.startsWith('[') && atividade.observacoes.endsWith(']')) {
      try {
        return JSON.parse(atividade.observacoes);
      } catch (e) {
        console.warn('Erro ao decodificar itens:', e);
      }
    }
  }
  return [];
}

interface ActivityCardProps {
  atividade: RdoAtividade;
  onToggleComplete: (id: string, concluido: boolean) => void;
  onEdit: (atividade: RdoAtividade) => void;
  onDelete: (id: string) => void;
}

export function ActivityCard({ atividade, onToggleComplete, onEdit, onDelete }: ActivityCardProps) {
  const [expanded, setExpanded] = useState(false);

  const IconComponent = (Icons as any)[atividade.icon] || Icons.Activity;
  const subItens = getSubItens(atividade);
  const markedSubItens = subItens.filter(i => i.marcado);

  const hasDetails = atividade.descricao || (atividade.observacoes && !atividade.observacoes.startsWith('__ITEMS__:')) || subItens.length > 0;

  return (
    <div
      className={`relative group rounded-2xl border transition-all duration-300 overflow-hidden ${
        atividade.concluido
          ? 'bg-green-50/50 dark:bg-green-950/20 border-green-200/60 dark:border-green-900/50'
          : 'bg-white dark:bg-[#1a1a1c] border-gray-200 dark:border-white/10 hover:border-yellow-400 hover:shadow-md'
      }`}
    >
      {/* Barra lateral colorida */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1.5 transition-colors duration-300 ${
          atividade.concluido ? 'bg-green-500' : 'bg-yellow-400'
        }`}
      />

      <div className="p-4 pl-5 flex items-start gap-4">
        {/* Ícone e status */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => onToggleComplete(atividade.id, !atividade.concluido)}
            className={`transition-all duration-300 transform hover:scale-110 cursor-pointer ${
              atividade.concluido ? 'text-green-600 dark:text-green-400' : 'text-gray-300 dark:text-gray-600 hover:text-green-500'
            }`}
            title={atividade.concluido ? 'Marcar como pendente' : 'Marcar como concluída'}
          >
            {atividade.concluido ? (
              <CheckCircle2 size={26} className="drop-shadow-xs" />
            ) : (
              <Circle size={26} />
            )}
          </button>

          <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-700 dark:text-gray-300">
            <IconComponent size={20} />
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h4
                className={`font-bold text-base leading-tight ${
                  atividade.concluido
                    ? 'text-green-700 dark:text-green-400 line-through decoration-green-400'
                    : 'text-gray-900 dark:text-white'
                }`}
              >
                {atividade.titulo}
              </h4>

              {atividade.area && (
                <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50">
                  📍 {atividade.area}
                </span>
              )}
            </div>

            {/* Ações */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <button
                onClick={() => onEdit(atividade)}
                className="p-2 rounded-lg text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-950/30 transition-colors cursor-pointer"
                title="Editar"
              >
                <Pencil size={16} />
              </button>
              <button
                onClick={() => onDelete(atividade.id)}
                className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                title="Excluir"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {/* Métricas gerais */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {atividade.quantidade !== undefined && atividade.quantidade !== null && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-white/5 text-xs font-medium text-gray-700 dark:text-gray-300">
                <Icons.Hash size={12} />
                Qtd: {atividade.quantidade}
              </span>
            )}

            {atividade.metragem !== undefined && atividade.metragem !== null && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-white/5 text-xs font-medium text-gray-700 dark:text-gray-300">
                <Icons.Ruler size={12} />
                {atividade.metragem} {atividade.unidade || 'm'}
              </span>
            )}

            {subItens.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-xs font-semibold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50">
                <Layers size={12} />
                {markedSubItens.length} de {subItens.length} sub-atividades
              </span>
            )}
          </div>

          {/* Sub-atividades da Área */}
          {subItens.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/5 flex flex-col gap-1.5">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Atividades Configuradas:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {subItens.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl text-xs border transition-colors ${
                      item.marcado
                        ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200'
                        : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-400 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className={`w-4 h-4 rounded-md flex items-center justify-center text-[10px] font-black ${
                        item.marcado ? 'bg-emerald-600 text-white' : 'border border-gray-300 dark:border-gray-600'
                      }`}>
                        {item.marcado ? '✓' : ''}
                      </span>
                      <span className="font-semibold truncate">{item.nome}</span>
                    </div>

                    {item.tipo === 'medicao' && item.valor && (
                      <span className="text-[11px] font-bold shrink-0">
                        {item.valor} {item.unidade || ''}
                        {(item.faixa || item.berma) && (
                          <span className="text-[10px] font-normal opacity-80 ml-1">
                            ({[item.faixa, item.berma].filter(Boolean).join(', ')})
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Descrição expandida */}
          {hasDetails && (
            <>
              <button
                onClick={() => setExpanded(!expanded)}
                className="mt-2 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors cursor-pointer"
              >
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {expanded ? 'Ocultar detalhes' : 'Ver observações'}
              </button>

              {expanded && (
                <div className="mt-2 p-3 bg-gray-50 dark:bg-white/5 rounded-xl space-y-1.5 text-xs text-gray-600 dark:text-gray-300 border border-black/5 dark:border-white/5">
                  {atividade.descricao && (
                    <div>
                      <span className="font-bold text-gray-700 dark:text-gray-200">Descrição: </span>
                      <span>{atividade.descricao}</span>
                    </div>
                  )}
                  {atividade.observacoes && !atividade.observacoes.startsWith('__ITEMS__:') && (
                    <div>
                      <span className="font-bold text-gray-700 dark:text-gray-200">Observações: </span>
                      <span>{atividade.observacoes}</span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Badge de concluído */}
      {atividade.concluido && (
        <div className="absolute top-2 right-2 px-2.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 text-xs font-bold border border-green-200 dark:border-green-800/50">
          Concluído
        </div>
      )}
    </div>
  );
}
