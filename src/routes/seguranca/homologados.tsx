import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { useTheme } from '../../contexts/ThemeContext'
import { FileText, ShieldAlert } from 'lucide-react'

export const Route = createFileRoute('/seguranca/homologados')({
  component: Homologados
})

function Homologados() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  
  // Cores dinâmicas
  const bgMain = isDark ? 'bg-[#050505]' : 'bg-gray-50'
  const textPrimary = isDark ? 'text-white' : 'text-gray-900'
  const textSecondary = isDark ? 'text-gray-400' : 'text-gray-500'
  const borderClass = isDark ? 'border-white/10' : 'border-gray-200'
  const cardBg = isDark ? 'bg-[#0A0A0A]' : 'bg-white'

  // Abas para visualização
  const tabs = [
    { id: 'produtos', label: 'Produtos Químicos e Ferramentas', icon: FileText, pdf: '/produtos-homologados.pdf' },
    { id: 'epis', label: 'Catálogo de EPIs', icon: ShieldAlert, pdf: '/catalogo-epis-homologados.pdf' }
  ]
  const [activeTab, setActiveTab] = useState(tabs[0].id)

  const currentPdf = tabs.find(t => t.id === activeTab)?.pdf

  return (
    <div className={`min-h-screen ${bgMain} p-6 lg:p-8 font-sans`}>
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className={`text-3xl font-bold tracking-tight ${textPrimary} font-serif`}>
              Catálogo Homologado
            </h1>
            <p className={`mt-2 ${textSecondary}`}>
              Visualize os catálogos oficiais de produtos e EPIs homologados para uso na operação.
            </p>
          </div>
        </div>

        {/* Container Principal */}
        <div className={`rounded-2xl border ${borderClass} ${cardBg} shadow-sm overflow-hidden flex flex-col`} style={{ height: 'calc(100vh - 180px)' }}>
          
          {/* Navegação de Abas */}
          <div className={`flex flex-wrap gap-2 p-4 border-b ${borderClass} ${isDark ? 'bg-[#050505]' : 'bg-gray-50/50'}`}>
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all
                    ${isActive 
                      ? 'bg-[#E5FF00] text-black shadow-[0_0_15px_rgba(229,255,0,0.3)]' 
                      : `hover:bg-black/5 dark:hover:bg-white/5 ${textSecondary} hover:${textPrimary}`
                    }
                  `}
                >
                  <Icon size={16} className={isActive ? 'text-black' : ''} />
                  {tab.label}
                  {isActive && (
                    <motion.div
                      layoutId="activeTabHomologados"
                      className="absolute inset-0 border border-[#E5FF00] rounded-xl"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </button>
              )
            })}
          </div>

          {/* Área de Visualização do PDF */}
          <div className="flex-1 w-full bg-gray-900/5 relative">
            <iframe
              src={`${currentPdf}#view=FitH`}
              className="absolute inset-0 w-full h-full border-0"
              title="Visualizador de PDF"
            />
          </div>
          
        </div>

      </div>
    </div>
  )
}
