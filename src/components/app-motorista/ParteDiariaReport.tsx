import React, { forwardRef } from 'react'
import { format } from 'date-fns'

interface TimelineEvent {
  time: string
  name: string
  type: string
  color?: string
}

export interface ParteDiariaReportProps {
  motorista: string
  ajudante?: string
  data: Date
  equipamentoNome: string
  placa: string
  obra?: string
  kmInicial: number | string
  kmFinal: number | string
  horimetroInicial: number | string
  horimetroFinal: number | string
  abastecimentoInicial: number | string
  abastecimentoFinal: number | string
  timeline: TimelineEvent[]
}

const FuelGauge = ({ value }: { value: number | string }) => {
  // SVG gauge mimicking the exact image
  const percentage = typeof value === 'number' ? value : parseInt(String(value)) || 0
  const angle = (percentage / 100) * 180 - 90 // -90 (E) to 90 (F)

  return (
    <div className="relative w-20 h-10 mx-auto mt-2">
      <svg viewBox="0 0 100 50" className="w-full h-full overflow-visible">
        {/* Track background */}
        <path
          d="M 10 50 A 40 40 0 0 1 90 50"
          fill="none"
          stroke="#f3f4f6"
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* Color segments to mimic the gauge (Red to Green) */}
        <path
          d="M 10 50 A 40 40 0 0 1 30 20"
          fill="none"
          stroke="#f87171" // Red
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M 30 20 A 40 40 0 0 1 70 20"
          fill="none"
          stroke="#fde047" // Yellow
          strokeWidth="12"
        />
        <path
          d="M 70 20 A 40 40 0 0 1 90 50"
          fill="none"
          stroke="#86efac" // Green
          strokeWidth="12"
          strokeLinecap="round"
        />
        
        {/* E and F labels */}
        <text x="-4" y="55" fontSize="11" fontWeight="bold" fill="#666">E</text>
        <text x="96" y="55" fontSize="11" fontWeight="bold" fill="#666">F</text>
        
        {/* Needle */}
        <g transform={`translate(50, 50) rotate(${angle})`}>
          <path d="M -3 -5 L 3 -5 L 0 -35 Z" fill="#ef4444" />
          <circle cx="0" cy="0" r="5" fill="#ef4444" />
          <circle cx="0" cy="0" r="2" fill="#fff" />
        </g>
      </svg>
    </div>
  )
}

const ParteDiariaReport = forwardRef<HTMLDivElement, ParteDiariaReportProps>(({
  motorista,
  ajudante = '',
  data,
  equipamentoNome,
  placa,
  obra = '460001269',
  kmInicial,
  kmFinal,
  horimetroInicial,
  horimetroFinal,
  abastecimentoInicial,
  abastecimentoFinal,
  timeline
}, ref) => {
  // Parse timeline to extract start/end time for each row
  const safeTimeline = timeline || []
  const sortedTimeline = [...safeTimeline].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
  
  const timelineRows = sortedTimeline.map((event, index) => {
    let startTime = ''
    let endTime = ''
    try {
      if (event.time) startTime = format(new Date(event.time), 'HH:mm')
    } catch (e) {}

    try {
      if (index < sortedTimeline.length - 1 && sortedTimeline[index + 1].time) {
        endTime = format(new Date(sortedTimeline[index + 1].time), 'HH:mm')
      }
    } catch (e) {}
    
    return {
      startTime,
      endTime,
      desc: `${event.type === 'Status Inicial' ? 'Início: ' : ''}${event.name}`
    }
  })

  // Fill up to exactly 19 rows to match the image precisely
  const EXACT_ROWS = 19
  while (timelineRows.length < EXACT_ROWS) {
    timelineRows.push({ startTime: '', endTime: '', desc: '' })
  }

  return (
    <div ref={ref} className="bg-[#ffffff] text-[#000000] font-sans relative" style={{ width: '800px', padding: '15px 30px', fontFamily: 'Arial, sans-serif' }}>
      
      <div className="flex justify-center mb-2">
        <img src="/logo-relatorio.png" alt="SUCENA Empreendimentos" className="h-14 object-contain" />
      </div>

      <div className="border-[1.5px] border-[#000000]">
        
        {/* Header Title */}
        <div className="flex border-b-[1.5px] border-[#000000] bg-[#f3f4f6]">
          <div className="flex-[3] font-bold text-center flex items-center justify-center py-2 text-[16px] border-r-[1.5px] border-[#000000] tracking-wide">
            PARTE DIÁRIA DE EQUIPAMENTO
          </div>
          <div className="w-[80px] flex items-center justify-center font-bold text-xs border-r-[1.5px] border-[#000000] bg-[#e5e7eb]">
            OBRA:
          </div>
          <div className="flex-1 flex items-center justify-center text-sm">
            {obra}
          </div>
        </div>

        {/* Info Rows */}
        <div className="text-xs font-bold uppercase">
          <div className="flex border-b-[1.5px] border-[#000000]">
            <div className="w-[180px] p-1.5 border-r-[1.5px] border-[#000000] bg-[#f3f4f6] flex items-center">MOTORISTA/OPERADOR</div>
            <div className="flex-1 p-1.5 border-r-[1.5px] border-[#000000] bg-[#ffffff] truncate">{motorista}</div>
            <div className="w-[60px] p-1.5 border-r-[1.5px] border-[#000000] bg-[#f3f4f6] text-center flex items-center justify-center">DATA</div>
            <div className="w-[180px] p-1.5 text-center flex items-center justify-center bg-[#ffffff]">{format(data, 'dd/MM/yyyy')}</div>
          </div>
          
          <div className="flex border-b-[1.5px] border-[#000000]">
            <div className="w-[180px] p-1.5 border-r-[1.5px] border-[#000000] bg-[#f3f4f6] flex items-center">EQUIPAMENTO</div>
            <div className="flex-1 p-1.5 border-r-[1.5px] border-[#000000] bg-[#ffffff] truncate">{equipamentoNome}</div>
            <div className="w-[60px] p-1.5 border-r-[1.5px] border-[#000000] bg-[#f3f4f6] text-center flex items-center justify-center">PLACA</div>
            <div className="w-[180px] p-1.5 text-center flex items-center justify-center bg-[#ffffff] truncate">{placa}</div>
          </div>
          
          <div className="flex border-b-[1.5px] border-[#000000]">
            <div className="w-[180px] p-1.5 border-r-[1.5px] border-[#000000] bg-[#f3f4f6] flex items-center">AJUDANTE</div>
            <div className="flex-1 p-1.5 bg-[#ffffff] truncate">{ajudante}</div>
          </div>
        </div>

        {/* Main Body Grid */}
        <div className="flex border-b-[1.5px] border-[#000000] h-[580px]">
          
          {/* Left Column (Meters) */}
          <div className="w-[230px] flex flex-col border-r-[1.5px] border-[#000000] text-xs font-bold text-center">
            
            <div className="bg-[#f3f4f6] p-1 border-b-[1.5px] border-[#000000]">KM</div>
            <div className="flex border-b-[1.5px] border-[#000000] h-[55px] bg-[#ffffff]">
              <div className="w-1/2 border-r-[1.5px] border-[#000000] flex flex-col pt-1.5 relative">
                <span className="text-[10px] text-[#374151] font-medium">INICIAL</span>
                <span className="mt-1 text-sm font-normal">{kmInicial || ''}</span>
              </div>
              <div className="w-1/2 flex flex-col pt-1.5 relative">
                <span className="text-[10px] text-[#374151] font-medium">FINAL</span>
                <span className="mt-1 text-sm font-normal">{kmFinal || ''}</span>
              </div>
            </div>

            <div className="bg-[#f3f4f6] p-1 border-b-[1.5px] border-[#000000]">HORÍMETRO</div>
            <div className="flex border-b-[1.5px] border-[#000000] h-[55px] bg-[#ffffff]">
              <div className="w-1/2 border-r-[1.5px] border-[#000000] flex flex-col pt-1.5 relative">
                <span className="text-[10px] text-[#374151] font-medium">INICIAL</span>
                <span className="mt-1 text-sm font-normal">{horimetroInicial || ''}</span>
              </div>
              <div className="w-1/2 flex flex-col pt-1.5 relative">
                <span className="text-[10px] text-[#374151] font-medium">FINAL</span>
                <span className="mt-1 text-sm font-normal">{horimetroFinal || ''}</span>
              </div>
            </div>

            {/* Abastecimento Double Border as in Image */}
            <div className="border-t-[3px] border-double border-[#000000] bg-[#f3f4f6] p-1 border-b-[1.5px]">ABASTECIMENTO</div>
            <div className="flex border-b-[1.5px] border-[#000000] h-[75px] bg-[#ffffff]">
               <div className="w-1/2 flex flex-col pt-1 relative">
                  <span className="text-[10px] text-[#374151] font-medium z-10 relative bg-[#ffffff] px-1 mt-1 mx-auto">INICIAL</span>
                  <div className="absolute inset-0 top-3 flex items-center justify-center scale-90">
                    <FuelGauge value={abastecimentoInicial} />
                  </div>
               </div>
               <div className="w-1/2 flex flex-col pt-1 relative">
                  <span className="text-[10px] text-[#374151] font-medium z-10 relative bg-[#ffffff] px-1 mt-1 mx-auto">FINAL</span>
                  <div className="absolute inset-0 top-3 flex items-center justify-center scale-90">
                    <FuelGauge value={abastecimentoFinal} />
                  </div>
               </div>
            </div>
            
            {/* Espaço em branco restante na esquerda */}
            <div className="flex-1 bg-[#ffffff]"></div>
          </div>

          {/* Right Column (Timeline Table) */}
          <div className="flex-1 flex flex-col text-xs font-bold">
            <div className="bg-[#f3f4f6] p-1 border-b-[1.5px] border-[#000000] text-center">
              DESCRIMINAÇÃO: SERVIÇOS, PARADAS E OBS.
            </div>
            
            {/* Timeline Headers */}
            <div className="flex border-b-[1.5px] border-[#000000] bg-[#f3f4f6] h-[22px]">
              <div className="w-[60px] text-center flex items-center justify-center border-r-[1.5px] border-[#000000] text-[10px]">HORÁRIO</div>
              <div className="w-[35px] border-r-[1.5px] border-[#000000]"></div>
              <div className="w-[60px] text-center flex items-center justify-center border-r-[1.5px] border-[#000000] text-[10px]">FINAL</div>
              <div className="flex-1 p-1"></div>
            </div>

            <div className="flex-1 flex flex-col bg-[#ffffff]">
               {/* Timeline Rows */}
               {timelineRows.map((row, i) => (
                 <div key={i} className={`flex border-b-[1.5px] border-[#000000] ${i === timelineRows.length - 1 ? 'border-b-0' : ''}`} style={{ flex: '1 1 0' }}>
                   <div className="w-[60px] border-r-[1.5px] border-[#000000] flex items-center justify-center text-[11px] font-normal">
                     {row.startTime}
                   </div>
                   <div className="w-[35px] border-r-[1.5px] border-[#000000] flex items-center justify-center text-[10px] text-[#374151] bg-[#f9fafb]">
                     ÀS
                   </div>
                   <div className="w-[60px] border-r-[1.5px] border-[#000000] flex items-center justify-center text-[11px] font-normal">
                     {row.endTime}
                   </div>
                   <div className="flex-1 px-2 flex items-center font-normal uppercase text-[10px] overflow-hidden whitespace-nowrap">
                     {row.desc}
                   </div>
                 </div>
               ))}
            </div>
          </div>
        </div>

        <div className="h-[120px] flex justify-between px-10 bg-[#ffffff]">
          <div className="w-[30%] text-center mt-auto mb-4 flex flex-col items-center overflow-hidden">
            <span className="text-xs font-bold mb-1 uppercase text-[#1f2937] truncate w-full px-1">{motorista}</span>
            <div className="border-t-[1.5px] border-[#000000] w-full pt-1">
              <span className="text-[10px] text-[#1f2937] font-medium">Motorista/Operador</span>
            </div>
          </div>
          
          <div className="w-[30%] text-center mt-auto mb-4 flex flex-col items-center">
            <span className="text-xs font-bold mb-1 uppercase text-[#1f2937]">Creriane Navegantes</span>
            <div className="border-t-[1.5px] border-[#000000] w-full pt-1">
              <span className="text-[10px] text-[#1f2937] font-medium">Encarregado/Apontador</span>
            </div>
          </div>

          <div className="w-[30%] text-center mt-auto mb-4 flex flex-col items-center">
            <span className="text-xs font-bold mb-1 uppercase text-[#1f2937]">Luís Carlos</span>
            <div className="border-t-[1.5px] border-[#000000] w-full pt-1">
              <span className="text-[10px] text-[#1f2937] font-medium">Gerência</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Instructions */}
      <div className="mt-2 text-[9px] leading-[1.3] text-[#000000] font-bold uppercase text-justify" style={{ letterSpacing: '-0.2px' }}>
        INSTRUÇÃO: 01 - PREENCHER O CABEÇALHO COM NOME, DATA, TIPO DE EQUIPAMENTO E PLACA/TAG - 02 - COLOCAR KM OU HORÍMETRO INICIAL E FINAL 03 - COLOCAR O HORÁRIO QUE INICIA CADA ATIVIDADE. 04 - COLOCAR HORÁRIO DE INICIO E FINAL QUANDO HOUVER DEFEITO MECÂNICO E DESCREVER O DEFEITO 05 - AO FINAL DA JORNADA DE TRABALHO ASSINAR E ENTREGAR PARA APONTADOR OU ENCARREGADO RESPONSÁVEL. 06 - A PARTE DIÁRIA DEVERÁ SER PREENCHIDA TODOS OS DIAS INCLUSIVE DOMINGOS E FÉRIADOS. 07 - O MOTORISTA/OPERADOR TEM ATÉ O DIA 02 DE CADA MÊS PARA ENTREGAR TODAS AS PARTES DIÁRIAS, E O APONTADOR TEM ATÉ O DIA 04 PARA ENVIAR PARA O SETOR DE CONFERÊNCIA, O DESCUMPRIMENTO DESSE ITEM IRÁ GERAR ADVERTÊNCIA POR ESCRITO.
      </div>
    </div>
  )
})

ParteDiariaReport.displayName = 'ParteDiariaReport'

export default ParteDiariaReport
