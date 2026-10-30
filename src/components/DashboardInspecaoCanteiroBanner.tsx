import React, { useState, useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'
import { HardHat, Calendar, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react'
import type { InspecaoRegistro } from './DashboardInspecaoCanteiroWidget'

function formatarDataBr(iso?: string): string {
  if (!iso) return '—'
  const parts = iso.split('-')
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  return iso
}

function calcularPrazoDias(dataIso?: string): { texto: string; cor: string } {
  if (!dataIso) return { texto: 'Sem data', cor: '#4b5563' }
  const [ano, mes, dia] = dataIso.split('-').map(Number)
  const alvo = new Date(ano, mes - 1, dia)
  alvo.setHours(0, 0, 0, 0)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const diffDias = Math.round((alvo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDias === 0) {
    return { texto: '🚨 É HOJE!', cor: '#b91c1c' }
  } else if (diffDias === 1) {
    return { texto: '⏳ É amanhã!', cor: '#b45309' }
  } else if (diffDias > 1) {
    return { texto: `Faltam ${diffDias} dias`, cor: '#1d4ed8' }
  } else {
    return { texto: `Inspeção realizada (${Math.abs(diffDias)}d atrás)`, cor: '#4b5563' }
  }
}

export function DashboardInspecaoCanteiroBanner() {
  const [inspecao, setInspecao] = useState<InspecaoRegistro | null>(null)

  useEffect(() => {
    const carregar = async () => {
      try {
        const env = typeof window !== 'undefined' ? localStorage.getItem('sucena_environment') || 'barcarena' : 'barcarena'
        const { data } = await supabase
          .from('global_settings')
          .select('value')
          .eq('key', `canteiro_inspecoes_${env}`)
          .maybeSingle()

        if (data?.value) {
          const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value
          if (Array.isArray(parsed) && parsed.length > 0) {
            setInspecao(parsed[0])
            return
          }
        }
        setInspecao(null)
      } catch (_) {
        setInspecao(null)
      }
    }

    carregar()

    const sub = supabase
      .channel('dash_canteiro_banner')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'global_settings' }, () => {
        carregar()
      })
      .subscribe()

    return () => {
      sub.unsubscribe()
    }
  }, [])

  if (!inspecao) return null

  const totalPontos = inspecao.itens?.length || 0
  const corrigidos = inspecao.itens?.filter((i) => i.corrigido).length || 0
  const prazo = calcularPrazoDias(inspecao.data)

  return (
    <div
      style={{
        marginBottom: '18px',
        padding: '14px 18px',
        background: '#fffbeb',
        border: '1.5px solid #f59e0b',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(245, 158, 11, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: '#f59e0b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#111827',
            flexShrink: 0,
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
        >
          <HardHat size={22} color="#111827" />
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '14px', fontWeight: 900, color: '#111827', letterSpacing: '-0.01em' }}>
              🏗️ INSPEÇÃO DE CANTEIRO AGENDADA
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                color: prazo.cor,
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                padding: '2px 8px',
                borderRadius: '999px',
              }}
            >
              {prazo.texto}
            </span>
          </div>

          <div style={{ fontSize: '12.5px', color: '#1f2937', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span>
              📅 <strong>Data:</strong> {formatarDataBr(inspecao.data)}
            </span>
            <span>
              📍 <strong>Local:</strong> {inspecao.local || 'Canteiro Central'}
            </span>
            <span>
              👤 <strong>Inspetor:</strong> {inspecao.responsavel || 'Não informado'}
            </span>
            <span style={{ color: corrigidos === totalPontos && totalPontos > 0 ? '#15803d' : '#b45309', fontWeight: 700 }}>
              📊 {corrigidos}/{totalPontos} itens corrigidos
            </span>
          </div>
        </div>
      </div>

      <Link
        to="/seguranca/inspecao-canteiro"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 14px',
          background: '#111827',
          color: '#ffffff',
          borderRadius: '8px',
          fontSize: '12px',
          fontWeight: 800,
          textDecoration: 'none',
          boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
          transition: 'background 0.2s',
        }}
      >
        <span>Ver Detalhes e Correções</span>
        <ArrowRight size={14} />
      </Link>
    </div>
  )
}
