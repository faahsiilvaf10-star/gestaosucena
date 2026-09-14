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

const ParteDiariaReport = forwardRef<HTMLDivElement, ParteDiariaReportProps>(({
  motorista,
  ajudante = '-',
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
  // We reverse it to chronologic order if it's descending
  const sortedTimeline = [...timeline].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
  
  const timelineRows = sortedTimeline.map((event, index) => {
    const startTime = format(new Date(event.time), 'HH:mm')
    // End time is either the start of the next event, or if it's the last event, '-' (or current time if still open)
    const endTime = index < sortedTimeline.length - 1 
      ? format(new Date(sortedTimeline[index + 1].time), 'HH:mm') 
      : '-'
    
    return {
      startTime,
      endTime,
      desc: `${event.type === 'Status Inicial' ? 'Início: ' : ''}${event.name}`
    }
  })

  // Fill up to 25 rows empty to make the layout look full
  const MIN_ROWS = 24
  while (timelineRows.length < MIN_ROWS) {
    timelineRows.push({ startTime: '', endTime: '', desc: '' })
  }

  return (
    <div ref={ref} className="bg-white text-black text-sm" style={{ width: '800px', padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <div className="border-[2px] border-black p-1 space-y-1">
        
        {/* Header Title */}
        <div className="flex border-[1.5px] border-black">
          <div className="flex-1 font-bold text-center py-2 text-lg">
            PARTE DIÁRIA DE EQUIPAMENTO
          </div>
          <div className="w-1/4 border-l-[1.5px] border-black flex flex-col justify-center bg-gray-100 px-2 font-bold text-xs text-center border-b-[1px]">
            OBRA:
          </div>
          <div className="w-1/4 flex flex-col justify-center px-2 font-bold">
            {obra}
          </div>
        </div>

        {/* Info Rows */}
        <div className="border-[1.5px] border-black text-xs font-bold uppercase">
          <div className="flex border-b-[1.5px] border-black">
            <div className="w-1/4 p-1 border-r-[1.5px] border-black bg-gray-100 flex items-center">MOTORISTA/OPERADOR</div>
            <div className="w-2/4 p-1 border-r-[1.5px] border-black">{motorista || '-'}</div>
            <div className="w-[10%] p-1 border-r-[1.5px] border-black bg-gray-100 text-center flex items-center justify-center">DATA</div>
            <div className="w-[15%] p-1 text-center flex items-center justify-center">{format(data, 'dd/MM/yyyy')}</div>
          </div>
          <div className="flex border-b-[1.5px] border-black">
            <div className="w-1/4 p-1 border-r-[1.5px] border-black bg-gray-100 flex items-center">EQUIPAMENTO</div>
            <div className="w-2/4 p-1 border-r-[1.5px] border-black">{equipamentoNome || '-'}</div>
            <div className="w-[10%] p-1 border-r-[1.5px] border-black bg-gray-100 text-center flex items-center justify-center">PLACA</div>
            <div className="w-[15%] p-1 text-center flex items-center justify-center">{placa || '-'}</div>
          </div>
          <div className="flex">
            <div className="w-1/4 p-1 border-r-[1.5px] border-black bg-gray-100 flex items-center">AJUDANTE</div>
            <div className="w-3/4 p-1">{ajudante || '-'}</div>
          </div>
        </div>

        {/* Main Body Grid */}
        <div className="flex border-[1.5px] border-black h-[600px]">
          {/* Left Column (Meters) */}
          <div className="w-1/3 flex flex-col border-r-[1.5px] border-black text-xs font-bold text-center">
            
            <div className="bg-gray-100 p-1 border-b-[1.5px] border-black">KM</div>
            <div className="flex border-b-[1.5px] border-black h-[45px]">
              <div className="w-1/2 border-r-[1.5px] border-black flex flex-col justify-center pt-1 relative">
                <span className="text-[9px] text-gray-500 absolute top-1 w-full left-0">INICIAL</span>
                <span className="mt-2 text-sm">{kmInicial || '-'}</span>
              </div>
              <div className="w-1/2 flex flex-col justify-center pt-1 relative">
                <span className="text-[9px] text-gray-500 absolute top-1 w-full left-0">FINAL</span>
                <span className="mt-2 text-sm">{kmFinal || '-'}</span>
              </div>
            </div>

            <div className="bg-gray-100 p-1 border-b-[1.5px] border-black mt-2 border-t-[1.5px]">HORÍMETRO</div>
            <div className="flex border-b-[1.5px] border-black h-[45px]">
              <div className="w-1/2 border-r-[1.5px] border-black flex flex-col justify-center pt-1 relative">
                <span className="text-[9px] text-gray-500 absolute top-1 w-full left-0">INICIAL</span>
                <span className="mt-2 text-sm">{horimetroInicial || '-'}</span>
              </div>
              <div className="w-1/2 flex flex-col justify-center pt-1 relative">
                <span className="text-[9px] text-gray-500 absolute top-1 w-full left-0">FINAL</span>
                <span className="mt-2 text-sm">{horimetroFinal || '-'}</span>
              </div>
            </div>

            <div className="bg-gray-100 p-1 border-b-[1.5px] border-black mt-2 border-t-[1.5px]">ABASTECIMENTO</div>
            <div className="flex flex-1 items-center pb-2 h-[45px]">
               <div className="w-1/2 border-r-[1.5px] border-black h-full flex flex-col justify-start pt-1 relative">
                  <span className="text-[9px] text-gray-500 absolute top-1 w-full left-0">INICIAL (%)</span>
                  <span className="mt-5 text-sm">{abastecimentoInicial ? `${abastecimentoInicial}%` : '-'}</span>
               </div>
               <div className="w-1/2 h-full flex flex-col justify-start pt-1 relative">
                  <span className="text-[9px] text-gray-500 absolute top-1 w-full left-0">FINAL (%)</span>
                  <span className="mt-5 text-sm">{abastecimentoFinal ? `${abastecimentoFinal}%` : '-'}</span>
               </div>
            </div>
            
            <div className="border-t-[1.5px] border-black flex-[3] flex flex-col bg-white">
              {/* Espaço em branco preenchimento */}
            </div>

          </div>

          {/* Right Column (Timeline Table) */}
          <div className="w-2/3 flex flex-col text-xs font-bold">
            <div className="bg-gray-100 p-1 border-b-[1.5px] border-black text-center">DESCRIMINAÇÃO: SERVIÇOS, PARADAS E OBS.</div>
            
            <div className="flex-1 flex flex-col">
               {/* Timeline Rows */}
               {timelineRows.map((row, i) => (
                 <div key={i} className={`flex border-b-[1px] border-gray-400 h-[24.1px]`}>
                   <div className="w-1/6 border-r-[1px] border-gray-400 flex items-center justify-center relative bg-gray-50/50">
                     {i === 0 && <span className="absolute top-[-15px] bg-gray-100 text-[9px] px-1 border-[1px] border-black w-[50px] text-center left-1/2 -translate-x-1/2 rounded-sm text-gray-400 z-10">HORÁRIO</span>}
                     {row.startTime}
                   </div>
                   <div className="w-1/6 border-r-[1.5px] border-black flex items-center justify-center relative bg-gray-50/50">
                      {i === 0 && <span className="absolute top-[-15px] bg-gray-100 text-[9px] px-1 border-[1px] border-black w-[50px] text-center left-1/2 -translate-x-1/2 rounded-sm text-gray-400 z-10">FINAL</span>}
                     {row.endTime}
                   </div>
                   <div className="w-4/6 px-2 flex items-center font-normal uppercase text-[11px] truncate">
                     {row.desc}
                   </div>
                 </div>
               ))}
            </div>
          </div>
        </div>

        {/* Footer Signatures */}
        <div className="pt-20 pb-6 flex justify-between px-6 border-x-[1.5px] border-black border-b-[1.5px]">
          <div className="w-[28%] text-center mt-auto">
            <div className="border-b-[1px] border-black mb-1 w-full relative">
               <span className="absolute w-full text-center bottom-1 text-sm">{motorista.split(' ').slice(0,3).join(' ')}</span>
            </div>
            <span className="text-[10px] text-gray-600 font-bold">Ass. Motorista/Op</span>
          </div>
          
          <div className="w-[28%] text-center mt-auto">
            <div className="border-b-[1px] border-black mb-1 w-full h-5 relative">
            </div>
            <span className="text-[10px] text-gray-600 font-bold">Ass. Encarreg./Apontador</span>
          </div>

          <div className="w-[28%] text-center mt-auto">
            <div className="border-b-[1px] border-black mb-1 w-full h-5 relative">
            </div>
            <span className="text-[10px] text-gray-600 font-bold">Ass. Gerência</span>
          </div>
        </div>

        {/* Footer Instructions */}
        <div className="p-2 text-[8px] leading-tight text-gray-600 uppercase font-bold text-justify">
          INSTRUÇÃO: 01 - PREENCHER O CABEÇALHO COM NOME, DATA, TIPO DE EQUIPAMENTO E PLACA/TAG - 02 - COLOCAR KM OU HORÍMETRO INICIAL E FINAL 03 - COLOCAR O HORÁRIO QUE INICIA CADA ATIVIDADE. 04 - COLOCAR HORÁRIO DE INICIO E FINAL QUANDO HOUVER DEFEITO MECÂNICO E DESCREVER O DEFEITO 05 - AO FINAL DA JORNADA DE TRABALHO ASSINAR E ENTREGAR PARA APONTADOR OU ENCARREGADO RESPONSÁVEL. 06 - A PARTE DIÁRIA DEVERÁ SER PREENCHIDA TODOS OS DIAS INCLUSIVE DOMINGOS E FÉRIADOS. 07 - O MOTORISTA/OPERADOR TEM ATÉ O DIA 02 DE CADA MÊS PARA ENTREGAR TODAS AS PARTES DIÁRIAS, E O APONTADOR TEM ATÉ O DIA 04 PARA ENVIAR PARA O SETOR DE CONFERÊNCIA, O DESCUMPRIMENTO DESSE ITEM IRÁ GERAR ADVERTÊNCIA POR ESCRITO.
        </div>
      </div>
    </div>
  )
})

ParteDiariaReport.displayName = 'ParteDiariaReport'

export default ParteDiariaReport
