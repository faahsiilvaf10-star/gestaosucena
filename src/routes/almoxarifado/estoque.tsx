import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { 
  Package, Wrench, Shield, Beaker, ArrowDownToLine, ArrowUpFromLine, 
  RefreshCcw, ClipboardList, BookOpen, Truck, Settings, Search, Filter, 
  Plus, Edit, Eye, Trash2, AlertTriangle, AlertCircle, CheckCircle2, Archive as ArchiveBox
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../contexts/ThemeContext'
import { NewItemModal } from '../../components/almoxarifado/NewItemModal'
import { ImportStockModal } from '../../components/almoxarifado/ImportStockModal'
import { StockUpdateModal } from '../../components/almoxarifado/StockUpdateModal'

export const Route = createFileRoute('/almoxarifado/estoque')({
  component: AlmoxarifadoRoute,
})

type TabType = 'visao-geral' | 'estoque' | 'epi' | 'ferramentas' | 'materiais' | 'quimicos'

function AlmoxarifadoRoute() {
  const { isDark } = useTheme()
  const [activeTab, setActiveTab] = useState<TabType>('visao-geral')
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'low_stock' | 'out_of_stock'>('all')
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  
  // Dashboard Metrics
  const [metrics, setMetrics] = useState({
    totalItems: 0,
    totalInStock: 0,
    belowMinStock: 0,
    outOfStock: 0,
    totalEPI: 0,
    totalTools: 0,
    borrowedTools: 0,
    totalChemicals: 0,
    entriesMonth: 0,
    exitsMonth: 0,
    estimatedValue: 0
  })

  // Modals
  const [showNewItemModal, setShowNewItemModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [updateModalConfig, setUpdateModalConfig] = useState<{product: any, type: 'in' | 'out'} | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: productsData, error } = await supabase
        .from('al_products')
        .select(`
          *,
          al_categories(name)
        `)
      
      if (error) {
        console.error("Erro ao buscar produtos. Tabela provavelmente ainda não existe.", error.message)
      }

      const items = productsData || []
      setProducts(items)
      
      // Calculate Metrics
      let inStock = 0
      let estimatedVal = 0
      let belowMin = 0
      let outStock = 0
      
      items.forEach(item => {
        const qty = Number(item.current_quantity) || 0
        const min = Number(item.min_stock) || 0
        const val = Number(item.unit_value) || 0
        
        if (qty > 0) inStock += qty
        if (qty === 0) outStock++
        else if (qty <= min) belowMin++
        
        estimatedVal += (qty * val)
      })

      setMetrics({
        totalItems: items.length,
        totalInStock: inStock,
        belowMinStock: belowMin,
        outOfStock: outStock,
        totalEPI: items.filter(i => i.al_categories?.name === 'EPI').length,
        totalTools: items.filter(i => i.al_categories?.name === 'Ferramentas').length,
        borrowedTools: 0, // TBA
        totalChemicals: items.filter(i => i.al_categories?.name === 'Produtos Químicos').length,
        entriesMonth: 0, // TBA
        exitsMonth: 0, // TBA
        estimatedValue: estimatedVal
      })
      
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const renderStatus = (qty: number, min: number) => {
    if (qty === 0) return <span className="bg-gray-500/20 text-gray-500 px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 w-fit"><span className="w-2 h-2 rounded-full bg-gray-500"></span> SEM ESTOQUE</span>
    if (qty <= min) return <span className="bg-red-500/20 text-red-500 px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 w-fit"><span className="w-2 h-2 rounded-full bg-red-500"></span> CRÍTICO</span>
    if (qty <= min * 1.5) return <span className="bg-yellow-500/20 text-yellow-600 dark:text-yellow-500 px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 w-fit"><span className="w-2 h-2 rounded-full bg-yellow-500"></span> ATENÇÃO</span>
    return <span className="bg-green-500/20 text-green-600 dark:text-green-500 px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 w-fit"><span className="w-2 h-2 rounded-full bg-green-500"></span> NORMAL</span>
  }

  return (
    <div className="flex flex-col gap-6 py-6 w-full max-w-7xl mx-auto h-[calc(100vh-140px)]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-[54px] font-display italic tracking-tight" style={{ lineHeight: '1' }}>Almoxarifado</h1>
          <p className="text-sm text-gray-500">Gestão completa de estoque, EPIs, ferramentas e materiais.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowImportModal(true)}
            className="bg-white hover:bg-gray-100 dark:bg-[#1a1a1b] dark:hover:bg-[#2a2a2c] text-gray-700 dark:text-gray-300 border border-black/10 dark:border-white/10 px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-sm text-sm"
          >
            <ArrowDownToLine size={18} /> Importar
          </button>
          <button 
            onClick={() => setShowNewItemModal(true)}
            className="bg-[#0866ff] hover:bg-[#0756d6] text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-sm text-sm"
          >
            <Plus size={18} /> Novo Item
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto hide-scrollbar border-b border-black/10 dark:border-white/10 shrink-0">
        {[
          { id: 'visao-geral', label: 'Visão Geral', icon: Package },
          { id: 'estoque', label: 'Estoque', icon: ClipboardList },
          { id: 'epi', label: 'EPI', icon: Shield },
          { id: 'ferramentas', label: 'Ferramentas', icon: Wrench },
          { id: 'quimicos', label: 'Químicos', icon: Beaker },
        ].map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-2 px-4 py-3 font-semibold text-sm transition-colors relative whitespace-nowrap ${isActive ? 'text-[#0866ff] dark:text-[#38bdf8]' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
            >
              <Icon size={16} />
              {tab.label}
              {isActive && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0866ff] dark:bg-[#38bdf8] rounded-t-full" />}
            </button>
          )
        })}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
        {loading ? (
          <div className="flex justify-center items-center h-40">Carregando dados...</div>
        ) : (
          <>
            {/* TAB: VISÃO GERAL */}
            {activeTab === 'visao-geral' && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in duration-300">
                <MetricCard title="Total de Itens Cadastrados" value={metrics.totalItems} />
                <MetricCard title="Quantidade em Estoque" value={metrics.totalInStock} />
                <MetricCard title="Abaixo do Estoque Mínimo" value={metrics.belowMinStock} />
                <MetricCard title="Sem Estoque" value={metrics.outOfStock} />
                
                <MetricCard title="EPIs Disponíveis" value={metrics.totalEPI} />
                <MetricCard title="Ferramentas Disponíveis" value={metrics.totalTools} />
                <MetricCard title="Produtos Químicos" value={metrics.totalChemicals} />
              </div>
            )}

            {/* LISTAGEM DE PRODUTOS (ESTOQUE E CATEGORIAS) */}
            {activeTab !== 'visao-geral' && (() => {
              const filteredProducts = products.filter(p => {
                const catName = p.al_categories?.name?.toUpperCase() || '';
                
                // Tab filter
                let tabMatch = true;
                if (activeTab === 'epi') tabMatch = catName === 'EPI';
                else if (activeTab === 'ferramentas') tabMatch = catName === 'FERRAMENTAS';
                else if (activeTab === 'quimicos') tabMatch = catName === 'PRODUTOS QUÍMICOS' || catName === 'QUÍMICOS';
                else if (activeTab === 'materiais') tabMatch = catName === 'MATERIAIS';
                if (!tabMatch) return false;

                // Search query filter
                if (searchQuery) {
                  const query = searchQuery.toLowerCase();
                  const matchCode = p.code?.toLowerCase().includes(query);
                  const matchName = p.name?.toLowerCase().includes(query);
                  const matchCat = catName.toLowerCase().includes(query);
                  if (!matchCode && !matchName && !matchCat) return false;
                }

                // Status filter
                const qty = Number(p.current_quantity) || 0;
                const min = Number(p.min_stock) || 0;
                
                if (filterStatus === 'low_stock') {
                  if (qty >= min || qty === 0) return false; // Usually out of stock is not just "below min", or maybe it is. I will exclude out of stock from low stock. Wait, if qty <= min and qty > 0.
                } else if (filterStatus === 'out_of_stock') {
                  if (qty > 0) return false;
                }

                return true;
              });

              return (
              <div className="flex flex-col gap-4 animate-in fade-in duration-300 h-full">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                      type="text" 
                      placeholder="Buscar por código, nome, categoria..." 
                      className="w-full bg-white dark:bg-[#1a1a1b] border border-black/10 dark:border-white/10 rounded-lg pl-10 pr-4 py-2 outline-none focus:border-[#0866ff] transition-colors"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="relative">
                    <button 
                      onClick={() => setShowFilterMenu(!showFilterMenu)}
                      className={`border px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors ${filterStatus !== 'all' ? 'bg-[#0866ff] text-white border-[#0866ff]' : 'bg-white dark:bg-[#1a1a1b] border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5'}`}
                    >
                      <Filter size={18} /> Filtros {filterStatus !== 'all' && <span className="w-2 h-2 rounded-full bg-white ml-1"></span>}
                    </button>
                    {showFilterMenu && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowFilterMenu(false)} />
                        <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-[#1a1a1b] rounded-xl shadow-xl border border-black/10 dark:border-white/10 z-50 overflow-hidden py-1">
                          <button 
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${filterStatus === 'all' ? 'font-bold text-[#0866ff]' : ''}`}
                            onClick={() => { setFilterStatus('all'); setShowFilterMenu(false); }}
                          >
                            Todos
                          </button>
                          <button 
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${filterStatus === 'low_stock' ? 'font-bold text-yellow-500' : ''}`}
                            onClick={() => { setFilterStatus('low_stock'); setShowFilterMenu(false); }}
                          >
                            Abaixo do Mínimo
                          </button>
                          <button 
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${filterStatus === 'out_of_stock' ? 'font-bold text-red-500' : ''}`}
                            onClick={() => { setFilterStatus('out_of_stock'); setShowFilterMenu(false); }}
                          >
                            Sem Estoque
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="bg-white dark:bg-[#1a1a1b] rounded-xl border border-black/10 dark:border-white/10 overflow-hidden flex-1 flex flex-col">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-gray-50 dark:bg-white/5 border-b border-black/10 dark:border-white/10 text-gray-500 font-semibold">
                        <tr>
                          <th className="p-3">Código</th>
                          <th className="p-3">Produto</th>
                          <th className="p-3">Categoria</th>
                          <th className="p-3">Estoque</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/5 dark:divide-white/5">
                        {filteredProducts.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-gray-500">Nenhum produto encontrado.</td>
                          </tr>
                        ) : (
                          filteredProducts.map(product => (
                            <tr key={product.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                              <td className="p-3 font-mono text-xs">{product.internal_code || '-'}</td>
                              <td className="p-3 font-semibold">{product.name}</td>
                              <td className="p-3">{product.al_categories?.name || '-'}</td>
                              <td className="p-3 font-bold">{product.current_quantity} <span className="text-xs text-gray-500 font-normal">{product.unit_of_measure}</span></td>
                              <td className="p-3">{renderStatus(product.current_quantity, product.min_stock)}</td>
                              <td className="p-3 flex items-center justify-end gap-2">
                                <button className="p-1.5 text-gray-500 hover:text-[#0866ff] bg-gray-100 dark:bg-white/5 rounded-md transition-colors" title="Ver Detalhes">
                                  <Eye size={16} />
                                </button>
                                <button 
                                  onClick={() => setUpdateModalConfig({ product, type: 'in' })}
                                  className="p-1.5 text-gray-500 hover:text-green-500 bg-gray-100 dark:bg-white/5 rounded-md transition-colors" 
                                  title="Dar Entrada"
                                >
                                  <ArrowDownToLine size={16} />
                                </button>
                                <button 
                                  onClick={() => setUpdateModalConfig({ product, type: 'out' })}
                                  className="p-1.5 text-gray-500 hover:text-red-500 bg-gray-100 dark:bg-white/5 rounded-md transition-colors" 
                                  title="Dar Saída"
                                >
                                  <ArrowUpFromLine size={16} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              )
            })()}
            
          </>
        )}
      </div>

      {/* Novo Item Modal (Phase 1) */}
      {showNewItemModal && (
        <NewItemModal 
          onClose={() => setShowNewItemModal(false)}
          onSuccess={() => {
            setShowNewItemModal(false)
            fetchData() // recarrega os dados
          }}
        />
      )}

      {/* Import Modal */}
      {showImportModal && (
        <ImportStockModal
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            setShowImportModal(false)
            fetchData()
          }}
        />
      )}

      {updateModalConfig && (
        <StockUpdateModal
          product={updateModalConfig.product}
          type={updateModalConfig.type}
          onClose={() => setUpdateModalConfig(null)}
          onSuccess={() => {
            setUpdateModalConfig(null)
            fetchData()
          }}
        />
      )}
    </div>
  )
}

function MetricCard({ title, value }: { title: string, value: string | number }) {
  return (
    <div className="bg-white dark:bg-[#1a1a1b] p-4 rounded-xl border border-black/5 dark:border-white/5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</span>
      <div className="text-5xl font-display mt-1">{value}</div>
    </div>
  )
}

const DollarSignIcon = (props: any) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
