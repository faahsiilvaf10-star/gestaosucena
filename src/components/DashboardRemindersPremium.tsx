import { useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type { Reminder } from '../lib/api-reminders'
import {
  getReminderCardColor,
  getReminderIsPulsing,
  isReminderForAllUsers,
  getReminderResponsibleIds,
} from '../lib/api-reminders'
import type { UserProfile } from '../lib/api-reminders'

/* ─────── constants ─────── */
const GOLD = '#FFC400'
const GOLD_DARK = '#E5A800'
const RED_NEON = '#ff2d2d'
const RED_DARK_BG = 'rgba(180,20,20,0.35)'

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
      style={{
        marginTop: 20,
        marginBottom: 8,
        background: '#ffffff',
        borderRadius: 32,
        padding: 6,
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
      }}
    >
      {/* ── OUTER CARD ── */}
      <div
        className="relative overflow-hidden transition-transform duration-300 hover:-translate-y-0.5"
        style={{
          background: 'linear-gradient(135deg, #101010 0%, #1a1a1a 40%, #0d0d0d 100%)',
          borderRadius: 26,
          border: '1.5px solid rgba(255,255,255,0.08)',
          boxShadow:
            '0 8px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
      >
        {/* gold corner accent top-right */}
        <div
          className="pointer-events-none absolute"
          style={{
            top: -40,
            right: -40,
            width: 220,
            height: 220,
            background: `radial-gradient(circle at 70% 30%, ${GOLD}18, transparent 70%)`,
          }}
        />

        {/* glassmorphism overlay */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(120deg, rgba(255,255,255,0.03) 0%, transparent 50%)',
            borderRadius: 28,
          }}
        />

        {/* ── HEADER ── */}
        <div
          className="relative z-10 flex items-center justify-between gap-4 flex-wrap"
          style={{ padding: '20px 24px 14px 24px' }}
        >
          <div className="flex items-center gap-4 min-w-0">
            {/* Calendar + bell 3D icon */}
            <div className="relative flex-shrink-0" style={{ width: 54, height: 54 }}>
              {/* gold base glow */}
              <div
                className="absolute inset-0 rounded-xl"
                style={{
                  background: `radial-gradient(circle, ${GOLD}44, transparent 70%)`,
                  transform: 'scale(1.3)',
                  filter: 'blur(6px)',
                }}
              />
              {/* icon body */}
              <div
                className="relative flex items-center justify-center rounded-xl"
                style={{
                  width: 54,
                  height: 54,
                  background: `linear-gradient(145deg, ${GOLD}, ${GOLD_DARK})`,
                  boxShadow: `0 4px 16px ${GOLD}55`,
                }}
              >
                {/* calendar body */}
                <svg
                  width="30"
                  height="30"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#000"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                  {/* bell inside */}
                  <path
                    d="M15 14a3 3 0 0 0-6 0c0 3.5-1.5 4.5-1.5 4.5h9S15 17.5 15 14z"
                    fill="#000"
                    stroke="#000"
                    strokeWidth="1.5"
                  />
                  <path d="M13.37 20a1 1 0 0 1-2.74 0" stroke="#000" strokeWidth="1.5" />
                </svg>
              </div>
            </div>

            {/* gold vertical separator */}
            <div
              style={{
                width: 3,
                height: 40,
                borderRadius: 2,
                background: `linear-gradient(180deg, ${GOLD}, ${GOLD_DARK})`,
                boxShadow: `0 0 8px ${GOLD}55`,
                flexShrink: 0,
              }}
            />

            {/* title + subtitle */}
            <div className="min-w-0">
              <h2
                style={{
                  margin: 0,
                  fontSize: 22,
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.2,
                  color: '#fff',
                  textTransform: 'uppercase',
                }}
              >
                Lembretes para{' '}
                <span style={{ color: GOLD }}>hoje</span>
              </h2>
              <p
                className="flex items-center gap-1.5"
                style={{
                  margin: '4px 0 0',
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.5)',
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

          {/* "Ver todos" button */}
          <button
            type="button"
            onClick={() => navigate({ to: '/lembretes' })}
            className="group/btn flex items-center gap-2 cursor-pointer transition-all duration-300"
            style={{
              padding: '8px 20px',
              borderRadius: 999,
              background: 'rgba(0,0,0,0.6)',
              border: `1.5px solid ${GOLD}88`,
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              boxShadow: `0 0 12px ${GOLD}22`,
              backdropFilter: 'blur(8px)',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              const t = e.currentTarget
              t.style.boxShadow = `0 0 20px ${GOLD}55`
              t.style.borderColor = GOLD
            }}
            onMouseLeave={(e) => {
              const t = e.currentTarget
              t.style.boxShadow = `0 0 12px ${GOLD}22`
              t.style.borderColor = `${GOLD}88`
            }}
          >
            Ver todos
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke={GOLD}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-transform duration-300 group-hover/btn:translate-x-0.5"
            >
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>
        </div>

        {/* ── REMINDER ITEMS ── */}
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

        {/* ── SAFETY STRIPE BOTTOM ── */}
        <div
          style={{
            marginTop: 16,
            height: 14,
            borderRadius: '0 0 26px 26px',
            background: `repeating-linear-gradient(
              -45deg,
              ${GOLD},
              ${GOLD} 12px,
              #050505 12px,
              #050505 24px
            )`,
            boxShadow: `inset 0 2px 6px rgba(0,0,0,0.5)`,
          }}
        />
      </div>
    </section>
  )
}

/* ─────── REMINDER ITEM ─────── */
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

  // Pick red or custom color
  const accentColor = customColor || RED_NEON
  const bgGradient = customColor
    ? `linear-gradient(135deg, color-mix(in srgb, ${customColor} 25%, #0a0a0a), color-mix(in srgb, ${customColor} 10%, #111))`
    : `linear-gradient(135deg, rgba(180,20,20,0.3) 0%, rgba(100,10,10,0.15) 100%)`

  return (
    <div
      onClick={onClick}
      title="Clique para abrir no módulo de Lembretes"
      className={`group/item cursor-pointer transition-all duration-300 hover:-translate-y-0.5 ${isPulsing ? 'reminder-card-pulse' : ''}`}
      style={{
        background: bgGradient,
        border: `1.5px solid ${accentColor}66`,
        borderRadius: 22,
        padding: '12px 16px',
        boxShadow: `0 0 20px ${accentColor}18, inset 0 1px 0 rgba(255,255,255,0.03)`,
        ...(isPulsing
          ? ({ '--reminder-pulse-shadow': accentColor } as React.CSSProperties)
          : {}),
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = `0 0 28px ${accentColor}33, inset 0 1px 0 rgba(255,255,255,0.05)`
        e.currentTarget.style.borderColor = `${accentColor}99`
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = `0 0 20px ${accentColor}18, inset 0 1px 0 rgba(255,255,255,0.03)`
        e.currentTarget.style.borderColor = `${accentColor}66`
      }}
    >
      <div className="flex items-center gap-3 w-full">
        {/* Bell icon square */}
        <div
          className="flex-shrink-0 flex items-center justify-center"
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: `linear-gradient(145deg, ${accentColor}44, ${accentColor}22)`,
            boxShadow: `0 0 14px ${accentColor}33`,
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </div>

        {/* Red vertical separator */}
        <div
          className="flex-shrink-0"
          style={{
            width: 2,
            height: 28,
            borderRadius: 1,
            background: `${accentColor}55`,
          }}
        />

        {/* Content */}
        <div className="flex items-center gap-3 flex-wrap flex-1 min-w-0">
          {/* Pulsing dot alert */}
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

          {/* Title */}
          <p
            className="font-bold text-white truncate"
            style={{
              fontSize: 15,
              letterSpacing: '0.02em',
              textTransform: 'uppercase',
              maxWidth: '30%',
              minWidth: 60,
            }}
          >
            {reminder.title}
          </p>

          {/* Separator */}
          <div
            className="flex-shrink-0 hidden sm:block"
            style={{
              width: 1.5,
              height: 22,
              background: 'rgba(255,255,255,0.12)',
            }}
          />

          {/* Time capsule */}
          {reminder.due_time && (
            <div
              className="flex items-center gap-1.5 flex-shrink-0"
              style={{
                padding: '4px 12px',
                borderRadius: 999,
                background: 'rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke={GOLD}
                strokeWidth="2"
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
                  color: '#fff',
                }}
              >
                {String(reminder.due_time).substring(0, 5)}
              </span>
            </div>
          )}

          {/* Separator */}
          {reminder.is_recurring && (
            <div
              className="flex-shrink-0 hidden sm:block"
              style={{
                width: 1.5,
                height: 22,
                background: 'rgba(255,255,255,0.12)',
              }}
            />
          )}

          {/* Recorrente capsule */}
          {reminder.is_recurring && (
            <div
              className="flex items-center gap-1.5 flex-shrink-0"
              style={{
                padding: '4px 12px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="rgba(255,255,255,0.7)"
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
                  color: 'rgba(255,255,255,0.7)',
                }}
              >
                Recorrente
              </span>
            </div>
          )}

          {/* Priority tag */}
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
                    ? 'rgba(220,38,38,0.25)'
                    : reminder.priority === 'Alta'
                      ? 'rgba(234,88,12,0.25)'
                      : 'rgba(37,99,235,0.25)',
                color:
                  reminder.priority === 'Urgente'
                    ? '#fca5a5'
                    : reminder.priority === 'Alta'
                      ? '#fdba74'
                      : '#93c5fd',
                border: `1px solid ${
                  reminder.priority === 'Urgente'
                    ? 'rgba(220,38,38,0.4)'
                    : reminder.priority === 'Alta'
                      ? 'rgba(234,88,12,0.4)'
                      : 'rgba(37,99,235,0.4)'
                }`,
              }}
            >
              {reminder.priority}
            </div>
          )}

          {/* "Todos" tag */}
          {isAll && (
            <div
              className="flex-shrink-0"
              style={{
                padding: '3px 10px',
                borderRadius: 6,
                fontSize: 10,
                fontWeight: 700,
                background: 'rgba(37,99,235,0.2)',
                color: '#93c5fd',
                border: '1px solid rgba(37,99,235,0.3)',
              }}
            >
              Todos
            </div>
          )}
        </div>

        {/* Arrow button */}
        <div
          className="flex-shrink-0 flex items-center justify-center transition-colors duration-200"
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(255,255,255,0.5)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-transform duration-200 group-hover/item:translate-x-0.5"
          >
            <path d="m9 6 6 6-6 6" />
          </svg>
        </div>
      </div>

      {/* Description row */}
      {reminder.description && (
        <p
          style={{
            margin: '6px 0 0 56px',
            fontSize: 12,
            color: 'rgba(255,255,255,0.4)',
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
