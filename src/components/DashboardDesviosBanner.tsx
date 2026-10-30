import React, { useState, useEffect, useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'
import { AlertTriangle, Clock, ArrowRight, ShieldAlert, MapPin, User, ChevronRight } from 'lucide-react'

export interface DesvioItem {
  uid: string
  dataRegistro: string
  titulo: string
  categoria: string
  prioridade: string
  risco: string
  gravidade: string
  local: string
  area: string
  tecnico: string
  previsao: string // YYYY-MM-DD
  sugestao: string
  respCorrecao: string
  statusFluxo: string
  foto?: string
  fotos?: string[]
  corrigido: boolean
}

function formatarDataBr(iso?: string): string {
  if (!iso) return '—'
  const parts = iso.split('-')
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  return iso
}

function calcularPrazoDias(dataIso?: string): { texto: string; corFundo: string; corTexto: string; corBorda: string; dias: number } {
  if (!dataIso) {
    return { texto: 'Sem data limite', corFundo: '#f3f4f6', corTexto: '#374151', corBorda: '#d1d5db', dias: 0 }
  }
  const parts = dataIso.split('-').map(Number)
  if (parts.length < 3 || isNaN(parts[0])) {
    return { texto: dataIso, corFundo: '#f3f4f6', corTexto: '#374151', corBorda: '#d1d5db', dias: 0 }
  }

  const alvo = new Date(parts[0], parts[1] - 1, parts[2])
  alvo.setHours(0, 0, 0, 0)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const diffDias = Math.round((alvo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDias < 0) {
    const abs = Math.abs(diffDias)
    return {
      texto: `🚨 Vencido há ${abs} dia${abs > 1 ? 's' : ''}`,
      corFundo: '#fee2e2',
      corTexto: '#991b1b',
      corBorda: '#ef4444',
      dias: diffDias,
    }
  } else if (diffDias === 0) {
    return {
      texto: '⏳ Vence HOJE!',
      corFundo: '#fef2f2',
      corTexto: '#b91c1c',
      corBorda: '#dc2626',
      dias: 0,
    }
  } else if (diffDias === 1) {
    return {
      texto: '⏳ Vence amanhã!',
      corFundo: '#fffbeb',
      corTexto: '#b45309',
      corBorda: '#f59e0b',
      dias: 1,
    }
  } else {
    return {
      texto: `Faltam ${diffDias} dias para corrigir`,
      corFundo: '#eff6ff',
      corTexto: '#1d4ed8',
      corBorda: '#3b82f6',
      dias: diffDias,
    }
  }
}

export function DashboardDesviosBanner() {
  const [desvios, setDesvios] = useState<DesvioItem[]>([])

  useEffect(() => {
    const carregar = async () => {
      try {
        const env = typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena'
        const storageKey = `desvios_seguranca_${env}`

        const { data } = await supabase
          .from('global_settings')
          .select('value')
          .eq('key', storageKey)
          .maybeSingle()

        if (data?.value) {
          const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value
          if (Array.isArray(parsed)) {
            setDesvios(parsed)
            return
          }
        }

        const local = localStorage.getItem(storageKey)
        if (local) {
          const parsed = JSON.parse(local)
          if (Array.isArray(parsed)) setDesvios(parsed)
        }
      } catch (_) {
        setDesvios([])
      }
    }

    carregar()

    const sub = supabase
      .channel('dash_desvios_banner_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'global_settings' }, () => {
        carregar()
      })
      .subscribe()

    return () => {
      sub.unsubscribe()
    }
  }, [])

  // Filtrar apenas desvios em aberto (não corrigidos e não cancelados)
  const abertos = useMemo(() => {
    return desvios
      .filter((d) => !d.corrigido && d.statusFluxo !== 'Corrigido' && d.statusFluxo !== 'Cancelado')
      .sort((a, b) => {
        // Ordenar por prazo mais urgente
        const prazoA = a.previsao || '9999-99-99'
        const prazoB = b.previsao || '9999-99-99'
        return prazoA.localeCompare(prazoB)
      })
  }, [desvios])

  if (abertos.length === 0) return null

  const principal = abertos[0]
  const prazo = calcularPrazoDias(principal.previsao)
  const isUrgente = prazo.dias <= 1

  return (
    <div
      style={{
        marginBottom: '18px',
        padding: '14px 18px',
        background: isUrgente ? '#fef2f2' : '#fffbeb',
        border: `1.5px solid ${isUrgente ? '#ef4444' : '#f59e0b'}`,
        borderRadius: '12px',
        boxShadow: isUrgente ? '0 3px 12px rgba(239, 68, 68, 0.15)' : '0 2px 8px rgba(245, 158, 11, 0.12)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        transition: 'all 0.2s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
        <div
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: isUrgente ? '#dc2626' : '#d97706',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            flexShrink: 0,
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
          }}
        >
          <AlertTriangle style={{ width: '22px', height: '22px' }} />
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                background: isUrgente ? '#fee2e2' : '#fef3c7',
                color: isUrgente ? '#991b1b' : '#92400e',
                padding: '2px 8px',
                borderRadius: '6px',
                border: `1px solid ${isUrgente ? '#fca5a5' : '#fcd34d'}`,
              }}
            >
              ⚠️ Desvio em Aberto {abertos.length > 1 ? `(1 de ${abertos.length})` : ''}
            </span>

            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '6px',
                background: prazo.corFundo,
                color: prazo.corTexto,
                border: `1px solid ${prazo.corBorda}`,
              }}
            >
              {prazo.texto}
            </span>

            {principal.prioridade && (
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: principal.prioridade === 'Alta' ? '#fee2e2' : '#f3f4f6',
                  color: principal.prioridade === 'Alta' ? '#991b1b' : '#374151',
                }}
              >
                Prioridade: {principal.prioridade}
              </span>
            )}
          </div>

          <h3
            style={{
              fontSize: '14.5px',
              fontWeight: 900,
              color: '#000000',
              marginTop: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {principal.titulo}
          </h3>

          <div
            style={{
              fontSize: '12px',
              color: '#374151',
              marginTop: '2px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap',
              fontWeight: 600,
            }}
          >
            {principal.local && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <MapPin style={{ width: '13px', height: '13px', color: '#6b7280' }} />
                <strong>Local:</strong> {principal.local} {principal.area ? `(${principal.area})` : ''}
              </span>
            )}
            {principal.previsao && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Clock style={{ width: '13px', height: '13px', color: '#6b7280' }} />
                <strong>Prazo Limite:</strong> {formatarDataBr(principal.previsao)}
              </span>
            )}
            {principal.respCorrecao && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <User style={{ width: '13px', height: '13px', color: '#6b7280' }} />
                <strong>Responsável:</strong> {principal.respCorrecao}
              </span>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Link
          to="/seguranca/desvios"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            background: isUrgente ? '#b91c1c' : '#b45309',
            color: '#ffffff',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 800,
            textDecoration: 'none',
            boxShadow: '0 2px 4px rgba(0,0,0,0.12)',
            transition: 'background 0.15s ease',
          }}
        >
          <span>Corrigir Desvio</span>
          <ArrowRight style={{ width: '14px', height: '14px' }} />
        </Link>
      </div>
    </div>
  )
}

