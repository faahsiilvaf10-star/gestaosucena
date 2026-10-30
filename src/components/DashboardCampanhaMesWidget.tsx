import React, { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { getCampanhaAtual, type CampanhaData } from '../lib/campanhasData'
import { ArrowRight, ChevronRight, X } from 'lucide-react'

export function DashboardCampanhaMesWidget() {
  const campanha: CampanhaData = getCampanhaAtual()
  const [fotoModal, setFotoModal] = useState<string | null>(null)

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-xs flex flex-col justify-between"
      style={{ borderLeft: `6px solid ${campanha.cor}` }}
    >
      <div>
        {/* Cabeçalho */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-2xs font-bold text-base"
              style={{ background: campanha.cor }}
            >
              🎗️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-gray-950 tracking-tight">
                  {campanha.camp}
                </h3>
                <span
                  className="px-2 py-0.5 text-[10px] font-black rounded-full text-white"
                  style={{ background: campanha.cor }}
                >
                  {campanha.mes}
                </span>
              </div>
              <p className="text-xs text-gray-500 font-medium">Campanha de Conscientização do Mês</p>
            </div>
          </div>

          <Link
            to="/seguranca/campanhas"
            className="text-xs font-bold text-amber-800 hover:text-amber-950 flex items-center gap-1 hover:underline transition"
          >
            Ver todas <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Card do Tema */}
        <div className="flex flex-col sm:flex-row gap-3 items-start bg-gray-50/70 p-3 rounded-xl border border-gray-200">
          {campanha.imagem && (
            <div
              className="shrink-0 w-full sm:w-24 h-24 rounded-lg bg-white border border-gray-300 overflow-hidden cursor-pointer hover:opacity-90 transition flex items-center justify-center"
              onClick={() => setFotoModal(campanha.imagem!)}
              title="Clique para ampliar a arte"
            >
              <img
                src={campanha.imagem}
                alt={campanha.camp}
                className="w-full h-full object-contain"
              />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-black uppercase text-gray-600 block mb-0.5">
              Conscientização do Mês
            </span>
            <h4 className="text-xs sm:text-sm font-black text-black leading-snug mb-1">
              {campanha.tema}
            </h4>
            <p className="text-xs text-gray-700 font-medium line-clamp-2 leading-relaxed">
              {campanha.desc}
            </p>
            <p className="text-[11px] font-bold text-black italic mt-1.5 border-l-2 border-amber-400 pl-2">
              “{campanha.frase}”
            </p>
          </div>
        </div>
      </div>

      {/* Rodapé com link */}
      <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-xs">
        <span className="text-gray-500 font-semibold text-[11px]">
          Segurança do Trabalho • Sucena
        </span>
        <Link
          to="/seguranca/campanhas"
          className="font-bold text-amber-800 hover:text-amber-950 flex items-center gap-1 hover:underline"
        >
          Calendário anual de campanhas <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Modal para ampliar a arte */}
      {fotoModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setFotoModal(null)}
        >
          <div
            className="relative max-w-xl max-h-[90vh] bg-white rounded-2xl p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-200">
              <span className="text-xs font-black text-gray-900 uppercase">
                Arte Oficial — {campanha.camp} ({campanha.mes})
              </span>
              <button
                onClick={() => setFotoModal(null)}
                className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition font-bold"
              >
                <X className="w-4 h-4 text-gray-700" />
              </button>
            </div>
            <img
              src={fotoModal}
              alt="Arte oficial ampliada"
              className="max-w-full max-h-[75vh] object-contain rounded-xl mx-auto"
            />
          </div>
        </div>
      )}
    </div>
  )
}

