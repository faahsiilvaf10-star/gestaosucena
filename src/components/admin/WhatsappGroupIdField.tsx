import React from 'react';
import Package from 'lucide-react/dist/esm/icons/package.js';
import Shield from 'lucide-react/dist/esm/icons/shield.js';
import Bell from 'lucide-react/dist/esm/icons/bell.js';
import AlertTriangle from 'lucide-react/dist/esm/icons/triangle-alert.js';
import Truck from 'lucide-react/dist/esm/icons/truck.js';
import Check from 'lucide-react/dist/esm/icons/check.js';
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw.js';
import { useTheme } from '../../contexts/ThemeContext';

export interface PresetWhatsappGroup {
  name: string;
  id: string;
  shortName: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  description: string;
}

export const PRESET_WHATSAPP_GROUPS: PresetWhatsappGroup[] = [
  {
    name: 'Grupo de estoque',
    id: '120363406691114696@g.us',
    shortName: 'Estoque',
    icon: Package,
    description: 'Materiais, EPIs, pedidos e movimentações de almoxarifado'
  },
  {
    name: 'Grupo de Liderança',
    id: '120363374999567363@g.us',
    shortName: 'Liderança',
    icon: Shield,
    description: 'Matriz de responsabilidades, análise de risco e gestão'
  },
  {
    name: 'Grupo de Avisos',
    id: '120363408136247156@g.us',
    shortName: 'Avisos',
    icon: Bell,
    description: 'DDS, vistorias, cor do mês, campanhas e avisos gerais'
  },
  {
    name: 'Grupo de Desvios',
    id: '120363409913606942@g.us',
    shortName: 'Desvios',
    icon: AlertTriangle,
    description: 'Registros e tratativas de desvios de segurança'
  },
  {
    name: 'Grupo de Motoristas',
    id: '120363402703768386@g.us',
    shortName: 'Motoristas',
    icon: Truck,
    description: 'Alertas, anomalias e operações do App Motorista'
  }
];

export interface WhatsappGroupIdFieldProps {
  label?: string;
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  placeholder?: string;
  helpText?: string;
  className?: string;
  recommendedGroupId?: string;
}

export const WhatsappGroupIdField: React.FC<WhatsappGroupIdFieldProps> = ({
  label = 'ID do grupo específico para este alerta (opcional)',
  value,
  onChange,
  disabled = false,
  placeholder = 'Ex: 120363408136247156@g.us',
  helpText,
  className = '',
  recommendedGroupId
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const currentValue = (value || '').trim();
  const matchedGroup = PRESET_WHATSAPP_GROUPS.find(g => g.id.toLowerCase() === currentValue.toLowerCase());

  return (
    <div className={`space-y-2.5 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="block text-xs font-semibold">{label}</label>
        {matchedGroup ? (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Vinculado: {matchedGroup.name}
          </span>
        ) : currentValue ? (
          <span className={`text-[11px] font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            ID personalizado
          </span>
        ) : null}
      </div>

      {/* Botões interativos de preenchimento rápido */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className={`text-[11px] font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Selecione o grupo para preencher automaticamente:
          </span>
          {currentValue && !disabled && (
            <button
              type="button"
              onClick={() => onChange('')}
              className={`text-[11px] font-medium flex items-center gap-1 hover:underline transition-colors ${
                isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-black'
              }`}
              title="Limpar campo e usar o grupo padrão"
            >
              <RotateCcw size={12} />
              Usar grupo padrão
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {PRESET_WHATSAPP_GROUPS.map(group => {
            const Icon = group.icon;
            const isSelected = currentValue === group.id;
            const isRecommended = recommendedGroupId && group.id === recommendedGroupId;

            return (
              <button
                key={group.id}
                type="button"
                disabled={disabled}
                onClick={() => !disabled && onChange(group.id)}
                className={`relative flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all text-left border ${
                  isSelected
                    ? 'bg-[#D6A72B] text-black font-semibold border-[#D6A72B] shadow-md shadow-[#D6A72B]/20 scale-[1.01]'
                    : isDark
                    ? 'bg-white/5 hover:bg-white/10 text-gray-200 border-white/10 hover:border-white/20'
                    : 'bg-white hover:bg-gray-100 text-gray-700 border-gray-200 hover:border-gray-300 shadow-xs'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}`}
                title={`${group.name} - ${group.description} (${group.id})`}
              >
                <div className={`p-1 rounded-lg shrink-0 ${isSelected ? 'bg-black/15 text-black' : isDark ? 'bg-white/10 text-[#D6A72B]' : 'bg-gray-100 text-[#D6A72B]'}`}>
                  <Icon size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-[11px] leading-tight">
                    {group.name}
                  </div>
                  <div className={`text-[9px] truncate ${isSelected ? 'text-black/75' : isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {group.shortName}
                  </div>
                </div>
                {isSelected ? (
                  <div className="w-4 h-4 rounded-full bg-black/20 text-black flex items-center justify-center shrink-0">
                    <Check size={11} strokeWidth={3} />
                  </div>
                ) : isRecommended ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#D6A72B] shrink-0" title="Grupo recomendado para este alerta" />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Input de texto manual com o ID */}
      <input
        type="text"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className={`w-full px-4 py-3 rounded-lg border outline-none transition-colors text-xs font-mono tracking-tight ${
          isDark
            ? 'bg-[#0a0a0c] border-white/10 focus:border-[#D6A72B] text-gray-100'
            : 'bg-white border-gray-300 focus:border-[#D6A72B] text-gray-900'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      />

      {helpText && (
        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
          {helpText}
        </p>
      )}
    </div>
  );
};
