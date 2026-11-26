import React from 'react'
import { useNavigate } from '@tanstack/react-router'
import type { Reminder, UserProfile } from '../lib/api-reminders'
import {
  getReminderCardColor,
  getReminderIsPulsing,
  isReminderForAllUsers,
} from '../lib/api-reminders'

/* ─────── constants ─────── */
const GOLD = '#FFC400'
const GOLD_DARK = '#E5A800'
const GOLD_TEXT = '#D97706'
const RED_ACCENT = '#DC2626'

/* ─────── component ─────── */
interface DashboardRemindersPremiumProps {
  reminders: Reminder[]
  users: UserProfile[]
}

export function DashboardRemindersPremium({
  reminders,
  users,
}: DashboardRemindersPremiumProps) {
  const navigate = useNavigate()

  const count = reminders.length
  if (count === 0) return null

  return (
    <section
      className="animate-in fade-in slide-in-from-top-3 duration-500"
      style={{ marginTop: 20, marginBottom: 8 }}
    >
      {/* ── CARD PRINCIPAL COM FUNDO BRANCO ── */}
      <div
        className="relative overflow-hidden transition-transform duration-300 hover:-translate-y-0.5"
        style={{
          background: '#FFFFFF',
          borderRadius: 28,
          border: '1.5px solid #E5E7EB',
          boxShadow:
            '0 4px 24px -2px rgba(0,0,0,0.06), 0 2px 8px -2px rgba(0,0,0,0.04)',
        }}
      >
        {/* Detalhe dourado suave no canto superior direito */}
        <div
          className="pointer-events-none absolute"
          style={{
            top: -40,
            right: -40,
            width: 240,
            height: 240,
            background: `radial-gradient(circle at 70% 30%, rgba(255,196,0,0.14), transparent 70%)`,
          }}
        />

        {/* ── CABEÇALHO ── */}
        <div
          className="relative z-10 flex items-center justify-between gap-4 flex-wrap"
          style={{ padding: '20px 24px 14px 24px' }}
        >
          <div className="flex items-center gap-4 min-w-0">
            {/* Ícone 3D de calendário com sino */}
            <div className="relative flex-shrink-0" style={{ width: 54, height: 54 }}>
              {/* Brilho dourado atrás */}
              <div
                className="absolute inset-0 rounded-2xl"
                style={{
                  background: `radial-gradient(circle, rgba(255,196,0,0.45), transparent 70%)`,
                  transform: 'scale(1.25)',
                  filter: 'blur(5px)',
                }}
              />
              {/* Corpo do ícone */}
              <div
                className="relative flex items-center justify-center rounded-2xl"
                style={{
                  width: 54,
                  height: 54,
                  background: `linear-gradient(145deg, ${GOLD}, ${GOLD_DARK})`,
                  boxShadow: `0 4px 14px rgba(255,196,0,0.4)`,
                }}
              >
                <svg
                  width="30"
                  height="30"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#1A1400"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                  {/* Sino no centro do calendário */}
                  <path
                    d="M15 14a3 3 0 0 0-6 0c0 3.5-1.5 4.5-1.5 4.5h9S15 17.5 15 14z"
                    fill="#1A1400"
                    stroke="#1A1400"
                    strokeWidth="1.5"
                  />
                  <path d="M13.37 20a1 1 0 0 1-2.74 0" stroke="#1A1400" strokeWidth="1.5" />
                </svg>
              </div>
            </div>

            {/* Separador vertical dourado */}
            <div
              style={{
                width: 3,
                height: 40,
                borderRadius: 2,
                background: `linear-gradient(180deg, ${GOLD}, ${GOLD_DARK})`,
                boxShadow: `0 0 8px rgba(255,196,0,0.45)`,
                flexShrink: 0,
              }}
            />

            {/* Título + Subtítulo */}
            <div className="min-w-0">
              <h2
                style={{
                  margin: 0,
                  fontSize: 22,
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.2,
                  color: '#111827',
                  textTransform: 'uppercase',
                }}
              >
                Lembretes para{' '}
                <span style={{ color: GOLD_TEXT }}>hoje</span>
              </h2>
              <p
                className="flex items-center gap-1.5"
                style={{
                  margin: '4px 0 0',
                  fontSize: 13,
                  color: '#6B7280',
                  fontWeight: 500,
                }}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ flexShrink: 0 }}
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
                {count} lembrete{count > 1 ? 's' : ''} agendado
                {count > 1 ? 's' : ''} para hoje
              </p>
            </div>
          </div>

          {/* Botão "Ver todos" com acabamento dourado */}
          <button
            type="button"
            onClick={() => navigate({ to: '/lembretes' })}
            className="group/btn flex items-center gap-2 cursor-pointer transition-all duration-300"
            style={{
              padding: '8px 20px',
              borderRadius: 999,
              background: '#FFFFFF',
              border: `1.5px solid ${GOLD_DARK}`,
              color: '#1F2937',
              fontSize: 13,
              fontWeight: 600,
              boxShadow: `0 1px 4px rgba(0,0,0,0.05)`,
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              const t = e.currentTarget
              t.style.background = '#FFFBEB'
              t.style.boxShadow = `0 2px 12px rgba(229,168,0,0.3)`
              t.style.borderColor = GOLD
            }}
            onMouseLeave={(e) => {
              const t = e.currentTarget
              t.style.background = '#FFFFFF'
              t.style.boxShadow = `0 1px 4px rgba(0,0,0,0.05)`
              t.style.borderColor = GOLD_DARK
            }}
          >
            Ver todos
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke={GOLD_TEXT}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-transform duration-300 group-hover/btn:translate-x-0.5"
            >
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>
        </div>

        {/* ── LISTA DE LEMBRETES ── */}
        <div
          className="relative z-10"
          style={{ padding: '0 24px 0 24px' }}
        >
          <div className="space-y-3">
            {reminders.map((reminder) => (
              <ReminderItem
                key={reminder.id}
                reminder={reminder}
                users={users}
                onClick={() => navigate({ to: '/lembretes' })}
              />
            ))}
          </div>
        </div>

        {/* ── FAIXA DE SEGURANÇA INFERIOR (AMARELA E PRETA) ── */}
        <div
          style={{
            marginTop: 16,
            height: 14,
            borderRadius: '0 0 26px 26px',
            background: `repeating-linear-gradient(
              -45deg,
              ${GOLD},
              ${GOLD} 12px,
              #18181B 12px,
              #18181B 24px
            )`,
            boxShadow: `inset 0 2px 4px rgba(0,0,0,0.2)`,
          }}
        />
      </div>
    </section>
  )
}

/* ─────── CARD INDIVIDUAL DO LEMBRETE ─────── */
function ReminderItem({
  reminder,
  users,
  onClick,
}: {
  reminder: Reminder
  users: UserProfile[]
  onClick: () => void
}) {
  const customColor = getReminderCardColor(reminder)
  const isPulsing = getReminderIsPulsing(reminder)
  const isAll = isReminderForAllUsers(reminder, users)

  // Cor de destaque (cor customizada ou vermelho padrão)
  const accentColor = customColor || RED_ACCENT

  const bgGradient = customColor
    ? `linear-gradient(135deg, color-mix(in srgb, ${customColor} 10%, #FFFFFF) 0%, color-mix(in srgb, ${customColor} 4%, #FFFFFF) 100%)`
    : `linear-gradient(135deg, #FFF5F5 0%, #FEF2F2 100%)`

  const borderColor = customColor
    ? `color-mix(in srgb, ${customColor} 50%, #FFFFFF)`
    : '#FECACA'

  return (
    <div
      onClick={onClick}
      title="Clique para abrir no módulo de Lembretes"
      className={`group/item cursor-pointer transition-all duration-300 hover:-translate-y-0.5 ${isPulsing ? 'reminder-card-pulse' : ''}`}
      style={{
        background: bgGradient,
        border: `1.5px solid ${borderColor}`,
        borderRadius: 22,
        padding: '12px 16px',
        boxShadow: `0 2px 10px ${accentColor}12, inset 0 1px 0 rgba(255,255,255,0.8)`,
        ...(isPulsing
          ? ({ '--reminder-pulse-shadow': accentColor } as React.CSSProperties)
          : {}),
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = `0 4px 18px ${accentColor}25, inset 0 1px 0 rgba(255,255,255,1)`
        e.currentTarget.style.borderColor = accentColor
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = `0 2px 10px ${accentColor}12, inset 0 1px 0 rgba(255,255,255,0.8)`
        e.currentTarget.style.borderColor = borderColor
      }}
    >
      <div className="flex items-center gap-3 w-full">
        {/* Quadrado com ícone de sino e efeito luminoso */}
        <div
          className="flex-shrink-0 flex items-center justify-center"
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: `linear-gradient(145deg, ${accentColor}, color-mix(in srgb, ${accentColor} 80%, #000))`,
            boxShadow: `0 2px 10px ${accentColor}40`,
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </div>

        {/* Separador vertical com cor do alerta */}
        <div
          className="flex-shrink-0"
          style={{
            width: 2,
            height: 28,
            borderRadius: 1,
            background: `color-mix(in srgb, ${accentColor} 35%, transparent)`,
          }}
        />

        {/* Conteúdo horizontal */}
        <div className="flex items-center gap-3 flex-wrap flex-1 min-w-0">
          {/* Bolinha pulsante de alerta */}
          <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ backgroundColor: accentColor }}
            />
            <span
              className="relative inline-flex rounded-full h-2.5 w-2.5"
              style={{ backgroundColor: accentColor }}
            />
          </span>

          {/* Nome do lembrete */}
          <p
            className="font-bold truncate"
            style={{
              fontSize: 15,
              letterSpacing: '0.01em',
              textTransform: 'uppercase',
              color: '#111827',
              maxWidth: '32%',
              minWidth: 60,
            }}
          >
            {reminder.title}
          </p>

          {/* Separador vertical */}
          <div
            className="flex-shrink-0 hidden sm:block"
            style={{
              width: 1.5,
              height: 22,
              background: '#E5E7EB',
            }}
          />

          {/* Cápsula de horário */}
          {reminder.due_time && (
            <div
              className="flex items-center gap-1.5 flex-shrink-0"
              style={{
                padding: '4px 12px',
                borderRadius: 999,
                background: '#FFFFFF',
                border: '1px solid #E5E7EB',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke={GOLD_TEXT}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#111827',
                }}
              >
                {String(reminder.due_time).substring(0, 5)}
              </span>
            </div>
          )}

          {/* Separador vertical se tiver recorrência */}
          {reminder.is_recurring && (
            <div
              className="flex-shrink-0 hidden sm:block"
              style={{
                width: 1.5,
                height: 22,
                background: '#E5E7EB',
              }}
            />
          )}

          {/* Cápsula "Recorrente" */}
          {reminder.is_recurring && (
            <div
              className="flex items-center gap-1.5 flex-shrink-0"
              style={{
                padding: '4px 12px',
                borderRadius: 999,
                background: '#FFFFFF',
                border: '1px solid #E5E7EB',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#6B7280"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m17 2 4 4-4 4" />
                <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
                <path d="m7 22-4-4 4-4" />
                <path d="M21 13v1a4 4 0 0 1-4 4H3" />
              </svg>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#4B5563',
                }}
              >
                Recorrente
              </span>
            </div>
          )}

          {/* Tag de Prioridade */}
          {reminder.priority !== 'Normal' && (
            <div
              className="flex-shrink-0"
              style={{
                padding: '3px 10px',
                borderRadius: 6,
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                background:
                  reminder.priority === 'Urgente'
                    ? '#FEF2F2'
                    : reminder.priority === 'Alta'
                      ? '#FFF7ED'
                      : '#EFF6FF',
                color:
                  reminder.priority === 'Urgente'
                    ? '#DC2626'
                    : reminder.priority === 'Alta'
                      ? '#EA580C'
                      : '#2563EB',
                border: `1px solid ${
                  reminder.priority === 'Urgente'
                    ? '#FECACA'
                    : reminder.priority === 'Alta'
                      ? '#FED7AA'
                      : '#BFDBFE'
                }`,
              }}
            >
              {reminder.priority}
            </div>
          )}

          {/* Tag "Todos" */}
          {isAll && (
            <div
              className="flex-shrink-0"
              style={{
                padding: '3px 10px',
                borderRadius: 6,
                fontSize: 10,
                fontWeight: 700,
                background: '#EFF6FF',
                color: '#2563EB',
                border: '1px solid #BFDBFE',
              }}
            >
              Todos
            </div>
          )}
        </div>

        {/* Botão com seta de navegação à direita */}
        <div
          className="flex-shrink-0 flex items-center justify-center transition-colors duration-200"
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#6B7280"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-transform duration-200 group-hover/item:translate-x-0.5"
          >
            <path d="m9 6 6 6-6 6" />
          </svg>
        </div>
      </div>

      {/* Descrição do lembrete */}
      {reminder.description && (
        <p
          style={{
            margin: '6px 0 0 56px',
            fontSize: 12,
            color: '#6B7280',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {reminder.description}
        </p>
      )}
    </div>
  )
}
