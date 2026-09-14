import { QrCode } from 'lucide-react'

export default function MercosulPlate({ plate }: { plate?: string }) {
  if (!plate || plate.toLowerCase() === 'sem placa') {
    return <span className="opacity-80 font-medium text-sm">Sem placa</span>
  }

  return (
    <div className="inline-flex flex-col border-[3px] border-[#003399] rounded-lg overflow-hidden bg-white shadow-sm select-none" style={{ width: '130px', height: '42px' }}>
      {/* Blue Top Strip */}
      <div className="bg-[#003399] text-white flex items-center justify-between px-1.5 h-[14px]">
        <div className="text-[5px] leading-[1] font-bold opacity-90 mt-0.5">MERCOSUL</div>
        <div className="text-[8px] font-bold tracking-widest mt-0.5">BRASIL</div>
        <div className="text-[7px]">🇧🇷</div>
      </div>
      
      {/* White Main Area */}
      <div className="relative flex-1 flex items-center justify-center bg-white h-[28px]">
        {/* QR Code pseudo */}
        <div className="absolute left-1 top-0.5">
          <QrCode size={10} className="text-black" />
        </div>
        {/* BR text */}
        <div className="absolute left-1 bottom-0.5 text-[7px] font-bold text-black leading-none">
          BR
        </div>
        
        {/* Plate Text */}
        <div className="text-black font-black text-lg tracking-widest uppercase mt-0.5" style={{ fontFamily: 'monospace' }}>
          {plate}
        </div>
      </div>
    </div>
  )
}
