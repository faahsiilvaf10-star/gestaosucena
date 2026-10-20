import { useState } from 'react';
import * as Icons from 'lucide-react';
import { CheckCircle2, Circle, Pencil, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { IconSelector } from './IconPicker';

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
  concluido: boolean;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
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

  const formatValue = (value: number | undefined, unit: string | undefined) => {
    if (value === undefined || value === null) return null;
    return `${value} ${unit || ''}`.trim();
  };

  const hasDetails = atividade.descricao || atividade.observacoes;

  return (
    <div className={`relative group rounded-2xl border transition-all duration-300 overflow-hidden
      ${atividade.concluido
        ? 'bg-green-50/50 border-green-200/50'
        : 'bg-white border-gray-200 hover:border-yellow-300 hover:shadow-md'
      }`}>

      {/* Barra lateral colorida */}
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 transition-colors duration-300
        ${atividade.concluido ? 'bg-green-500' : 'bg-yellow-400'}`} />

      <div className="p-4 pl-5 flex items-start gap-4">
        {/* Ícone e status */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => onToggleComplete(atividade.id, !atividade.concluido)}
            className={`transition-all duration-300 transform hover:scale-110
              ${atividade.concluido ? 'text-green-600' : 'text-gray-300 hover:text-green-500'}`}
          >
            {atividade.concluido ? (
              <CheckCircle2 size={28} className="drop-shadow-sm" />
            ) : (
              <Circle size={28} />
            )}
          </button>

          <div className="w-10 h-10 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-600">
            <IconComponent size={20} />
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h4 className={`font-semibold text-base leading-tight
                ${atividade.concluido ? 'text-green-700 line-through decoration-green-400' : 'text-gray-900'}`}>
                {atividade.titulo}
              </h4>

              {atividade.area && (
                <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                  {atividade.area}
                </span>
              )}
            </div>

            {/* Ações */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <button
                onClick={() => onEdit(atividade)}
                className="p-2 rounded-lg text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 transition-colors"
                title="Editar"
              >
                <Pencil size={16} />
              </button>
              <button
                onClick={() => onDelete(atividade.id)}
                className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Excluir"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {/* Métricas */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {(atividade.quantidade !== undefined && atividade.quantidade !== null) && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 text-xs font-medium text-gray-700">
                <Icons.Hash size={12} />
                Qtd: {atividade.quantidade}
              </span>
            )}

            {(atividade.metragem !== undefined && atividade.metragem !== null) && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 text-xs font-medium text-gray-700">
                <Icons.Ruler size={12} />
                {atividade.metragem} {atividade.unidade || 'm'}
              </span>
            )}

            {atividade.unidade && !atividade.metragem && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 text-xs font-medium text-gray-700">
                {atividade.unidade}
              </span>
            )}
          </div>

          {/* Descrição expandida */}
          {hasDetails && (
            <>
              <button
                onClick={() => setExpanded(!expanded)}
                className="mt-2 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {expanded ? 'Ocultar detalhes' : 'Ver detalhes'}
              </button>

              {expanded && (
                <div className="mt-2 space-y-2 text-sm text-gray-600">
                  {atividade.descricao && (
                    <div>
                      <span className="font-medium text-gray-500">Descrição:</span>
                      <p className="mt-0.5">{atividade.descricao}</p>
                    </div>
                  )}
                  {atividade.observacoes && (
                    <div>
                      <span className="font-medium text-gray-500">Observações:</span>
                      <p className="mt-0.5">{atividade.observacoes}</p>
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
        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
          Concluído
        </div>
      )}
    </div>
  );
}
