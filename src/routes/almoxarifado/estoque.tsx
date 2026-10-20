import Package from 'lucide-react/dist/esm/icons/package.js';
import Wrench from 'lucide-react/dist/esm/icons/wrench.js';
import Shield from 'lucide-react/dist/esm/icons/shield.js';
import Beaker from 'lucide-react/dist/esm/icons/beaker.js';
import ArrowDownToLine from 'lucide-react/dist/esm/icons/arrow-down-to-line.js';
import ArrowUpFromLine from 'lucide-react/dist/esm/icons/arrow-up-from-line.js';
import RefreshCcw from 'lucide-react/dist/esm/icons/refresh-ccw.js';
import ClipboardList from 'lucide-react/dist/esm/icons/clipboard-list.js';
import BookOpen from 'lucide-react/dist/esm/icons/book-open.js';
import Truck from 'lucide-react/dist/esm/icons/truck.js';
import Settings from 'lucide-react/dist/esm/icons/settings.js';
import Search from 'lucide-react/dist/esm/icons/search.js';
import Filter from 'lucide-react/dist/esm/icons/funnel.js';
import Plus from 'lucide-react/dist/esm/icons/plus.js';
import Edit from 'lucide-react/dist/esm/icons/square-pen.js';
import Eye from 'lucide-react/dist/esm/icons/eye.js';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2.js';
import AlertTriangle from 'lucide-react/dist/esm/icons/triangle-alert.js';
import AlertCircle from 'lucide-react/dist/esm/icons/circle-alert.js';
import CheckCircle2 from 'lucide-react/dist/esm/icons/circle-check.js';
import ArchiveBox from 'lucide-react/dist/esm/icons/archive-box.js';
import Loader2 from 'lucide-react/dist/esm/icons/loader-circle.js';
import X from 'lucide-react/dist/esm/icons/x.js';
import CheckSquare from 'lucide-react/dist/esm/icons/square-check.js';
import Square from 'lucide-react/dist/esm/icons/square.js';
import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../contexts/ThemeContext';
import { NewItemModal } from '../../components/almoxarifado/NewItemModal';
import { ImportStockModal } from '../../components/almoxarifado/ImportStockModal';
import { StockUpdateModal } from '../../components/almoxarifado/StockUpdateModal';
import { EditItemModal } from '../../components/almoxarifado/EditItemModal';
import { StockAlertBanner } from '../../components/almoxarifado/StockAlertBanner';
import { canEditAlmoxarifado } from '../../components/ui/VerifiedBadge';

export const Route = createFileRoute('/almoxarifado/estoque')({
  component: AlmoxarifadoRoute,
});

type TabType = 'visao-geral' | 'estoque' | 'epi' | 'ferramentas' | 'materiais' | 'quimicos';

function AlmoxarifadoRoute() {
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>('visao-geral');
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // User info for editing permissions and notifications
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'low_stock' | 'out_of_stock'>('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  // Selection & Deletion states
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [itemToDelete, setItemToDelete] = useState<any | null>(null);
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
    estimatedValue: 0,
  });

  // Modals
  const [showNewItemModal, setShowNewItemModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [updateModalConfig, setUpdateModalConfig] = useState<{ product: any; type: 'in' | 'out' } | null>(null);
  const [editModalProduct, setEditModalProduct] = useState<any>(null);

  // Check if current user can edit
  const canEdit = canEditAlmoxarifado(userName, userRole);

  useEffect(() => {
    fetchData();
    fetchUserInfo();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: productsData, error } = await supabase
        .from('al_products')
        .select(`
          *,
          al_categories(name)
        `)
        .or('status.eq.Ativo,status.is.null')
        .order('name');

      if (error) {
        console.error('Erro ao buscar produtos:', error.message);
      }

      const items = productsData || [];
      setProducts(items);

      // Limpar IDs selecionados que não existem mais
      setSelectedIds(prev => {
        const next = new Set<string>();
        const currentIds = new Set(items.map(i => i.id));
        prev.forEach(id => {
          if (currentIds.has(id)) next.add(id);
        });
        return next;
      });

      // Calculate Metrics
      let inStock = 0;
      let estimatedVal = 0;
      let belowMin = 0;
      let outStock = 0;

      items.forEach(item => {
        const qty = Number(item.current_quantity) || 0;
        const min = Number(item.min_stock) || 0;
        const val = Number(item.unit_value) || 0;

        if (qty > 0) inStock += qty;
        if (qty === 0) outStock++;
        else if (qty <= min) belowMin++;

        estimatedVal += qty * val;
      });

      setMetrics({
        totalItems: items.length,
        totalInStock: inStock,
        belowMinStock: belowMin,
        outOfStock: outStock,
        totalEPI: items.filter(i => i.al_categories?.name === 'EPI').length,
        totalTools: items.filter(i => i.al_categories?.name === 'Ferramentas').length,
        borrowedTools: 0,
        totalChemicals: items.filter(i => i.al_categories?.name === 'Produtos Químicos').length,
        entriesMonth: 0,
        exitsMonth: 0,
        estimatedValue: estimatedVal,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserName(user.user_metadata?.full_name || user.user_metadata?.name || '');
        setUserRole(user.user_metadata?.role || '');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle selection for a single product
  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Toggle selection for all visible products
  const toggleSelectAll = (visibleItems: any[]) => {
    const visibleIds = visibleItems.map(p => p.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));

    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        visibleIds.forEach(id => next.delete(id));
      } else {
        visibleIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // Delete a single product
  const executeSingleDelete = async (product: any) => {
    if (!product) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('al_products')
        .delete()
        .eq('id', product.id);

      if (error) {
        if (error.code === '23503' || error.message?.includes('foreign key')) {
          const { error: softErr } = await supabase
            .from('al_products')
            .update({ status: 'Inativo' })
            .eq('id', product.id);

          if (softErr) {
            throw new Error('Não é possível excluir o item pois ele possui histórico de movimentações vinculadas.');
          }
          toast.success(`Item "${product.name}" inativado com sucesso!`);
        } else {
          throw error;
        }
      } else {
        toast.success(`Item "${product.name}" excluído com sucesso!`);
      }

      setItemToDelete(null);
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
      await fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao excluir item: ' + (err.message || 'Erro inesperado'));
    } finally {
      setIsDeleting(false);
    }
  };

  // Delete multiple selected products
  const executeBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsDeleting(true);
    const idsToDelete = Array.from(selectedIds);

    try {
      const { error } = await supabase
        .from('al_products')
        .delete()
        .in('id', idsToDelete);

      if (error) {
        // Fallback: tentar deletar um a um para deletar os sem vínculo e inativar os com vínculo
        let deletedCount = 0;
        let inactivedCount = 0;
        let failedCount = 0;

        for (const id of idsToDelete) {
          const { error: singleErr } = await supabase
            .from('al_products')
            .delete()
            .eq('id', id);

          if (!singleErr) {
            deletedCount++;
          } else if (singleErr.code === '23503' || singleErr.message?.includes('foreign key')) {
            const { error: softErr } = await supabase
              .from('al_products')
              .update({ status: 'Inativo' })
              .eq('id', id);
            if (!softErr) {
              inactivedCount++;
            } else {
              failedCount++;
            }
          } else {
            failedCount++;
          }
        }

        if (deletedCount > 0 || inactivedCount > 0) {
          let msg = `${deletedCount} item(ns) excluído(s)`;
          if (inactivedCount > 0) msg += ` e ${inactivedCount} inativado(s)`;
          if (failedCount > 0) msg += ` (${failedCount} não puderam ser excluídos)`;
          toast.success(msg);
        } else {
          toast.error('Não foi possível excluir os itens selecionados.');
        }
      } else {
        toast.success(`${idsToDelete.length} item(ns) excluído(s) com sucesso!`);
      }

      setSelectedIds(new Set());
      setShowBatchDeleteModal(false);
      await fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao excluir itens selecionados: ' + (err.message || 'Erro inesperado'));
    } finally {
      setIsDeleting(false);
    }
  };

  const renderStatus = (qty: number, min: number) => {
    if (qty === 0)
      return (
        <span className="bg-gray-500/20 text-gray-500 px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 w-fit">
          <span className="w-2 h-2 rounded-full bg-gray-500"></span> SEM ESTOQUE
        </span>
      );
    if (qty <= min)
      return (
        <span className="bg-red-500/20 text-red-500 px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 w-fit">
          <span className="w-2 h-2 rounded-full bg-red-500"></span> CRÍTICO
        </span>
      );
    if (qty <= min * 1.5)
      return (
        <span className="bg-yellow-500/20 text-yellow-600 dark:text-yellow-500 px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 w-fit">
          <span className="w-2 h-2 rounded-full bg-yellow-500"></span> ATENÇÃO
        </span>
      );
    return (
      <span className="bg-green-500/20 text-green-600 dark:text-green-500 px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 w-fit">
        <span className="w-2 h-2 rounded-full bg-green-500"></span> NORMAL
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-6 py-6 w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="tracking-tight" style={{ fontSize: 'clamp(28px, 8vw, 54px)', lineHeight: '1' }}>
            Almoxarifado
          </h1>
          <p className="text-sm text-gray-500">Gestão completa de estoque, EPIs, ferramentas e materiais.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="bg-white hover:bg-gray-100 dark:bg-[#1a1a1b] dark:hover:bg-[#2a2a2c] text-gray-700 dark:text-gray-300 border border-black/10 dark:border-white/10 px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-sm text-sm cursor-pointer"
          >
            <ArrowDownToLine size={18} /> Importar
          </button>
          <button
            onClick={() => setShowNewItemModal(true)}
            className="bg-[#0866ff] hover:bg-[#0756d6] text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-sm text-sm cursor-pointer"
          >
            <Plus size={18} /> Novo Item
          </button>
        </div>
      </div>

      {/* Low Stock Alert Banner */}
      <StockAlertBanner />

      {/* Tabs */}
      <div className="flex overflow-x-auto hide-scrollbar border-b border-black/10 dark:border-white/10 shrink-0">
        {[
          { id: 'visao-geral', label: 'Visão Geral', icon: Package },
          { id: 'estoque', label: 'Estoque', icon: ClipboardList },
          { id: 'epi', label: 'EPI', icon: Shield },
          { id: 'ferramentas', label: 'Ferramentas', icon: Wrench },
          { id: 'quimicos', label: 'Químicos', icon: Beaker },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-2 px-4 py-3 font-semibold text-sm transition-colors relative whitespace-nowrap cursor-pointer ${
                isActive ? 'text-[#0866ff] dark:text-[#38bdf8]' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Icon size={16} />
              {tab.label}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0866ff] dark:bg-[#38bdf8] rounded-t-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div className="flex-1">
        {loading ? (
          <div className="flex justify-center items-center h-40 text-gray-500">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            Carregando dados...
          </div>
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
                else if (activeTab === 'quimicos')
                  tabMatch = catName === 'PRODUTOS QUÍMICOS' || catName === 'QUÍMICOS';
                else if (activeTab === 'materiais') tabMatch = catName === 'MATERIAIS';
                if (!tabMatch) return false;

                // Search query filter
                if (searchQuery) {
                  const query = searchQuery.toLowerCase();
                  const matchCode = p.internal_code?.toLowerCase().includes(query) || p.code?.toLowerCase().includes(query);
                  const matchName = p.name?.toLowerCase().includes(query);
                  const matchCat = catName.toLowerCase().includes(query);
                  if (!matchCode && !matchName && !matchCat) return false;
                }

                // Status filter
                const qty = Number(p.current_quantity) || 0;
                const min = Number(p.min_stock) || 0;

                if (filterStatus === 'low_stock') {
                  if (qty > min || qty === 0) return false;
                } else if (filterStatus === 'out_of_stock') {
                  if (qty > 0) return false;
                }

                return true;
              });

              const allVisibleSelected =
                filteredProducts.length > 0 && filteredProducts.every(p => selectedIds.has(p.id));

              return (
                <div className="flex flex-col gap-4 animate-in fade-in duration-300">
                  {/* Floating / Sticky Bulk Action Bar */}
                  {selectedIds.size > 0 && (
                    <div className="sticky top-4 z-30 flex items-center justify-between gap-4 bg-gradient-to-r from-[#0866ff] to-blue-700 text-white px-5 py-3 rounded-2xl shadow-xl border border-white/20 animate-in fade-in slide-in-from-top-3 duration-200">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center font-bold text-sm">
                          {selectedIds.size}
                        </span>
                        <div>
                          <p className="font-bold text-sm leading-tight">
                            {selectedIds.size === 1
                              ? '1 item selecionado'
                              : `${selectedIds.size} itens selecionados`}
                          </p>
                          <p className="text-xs text-white/80">Marque ou desmarque para aplicar ações em lote</p>
                        </div>
                        <button
                          onClick={clearSelection}
                          className="text-xs text-white/90 hover:text-white underline ml-3 cursor-pointer transition-colors"
                        >
                          Desmarcar todos
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowBatchDeleteModal(true)}
                          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer active:scale-95"
                          title="Excluir todos os itens selecionados"
                        >
                          <Trash2 size={15} />
                          <span>Excluir Selecionados ({selectedIds.size})</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Search and Filters */}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5f6472] dark:text-gray-400"
                        size={18}
                      />
                      <input
                        type="text"
                        placeholder="Buscar por código, nome, categoria..."
                        className="w-full bg-white dark:bg-[#1a1a1b] border border-black/10 dark:border-white/10 rounded-lg pl-10 pr-4 py-2 outline-none focus:border-[#0866ff] transition-colors"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <div className="relative">
                      <button
                        onClick={() => setShowFilterMenu(!showFilterMenu)}
                        className={`border px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                          filterStatus !== 'all'
                            ? 'bg-[#0866ff] text-white border-[#0866ff]'
                            : 'bg-white dark:bg-[#1a1a1b] border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                      >
                        <Filter size={18} /> Filtros{' '}
                        {filterStatus !== 'all' && <span className="w-2 h-2 rounded-full bg-white ml-1"></span>}
                      </button>
                      {showFilterMenu && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setShowFilterMenu(false)} />
                          <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-[#1a1a1b] rounded-xl shadow-xl border border-black/10 dark:border-white/10 z-50 overflow-hidden py-1">
                            <button
                              className={`w-full text-left px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer ${
                                filterStatus === 'all' ? 'font-bold text-[#0866ff]' : ''
                              }`}
                              onClick={() => {
                                setFilterStatus('all');
                                setShowFilterMenu(false);
                              }}
                            >
                              Todos
                            </button>
                            <button
                              className={`w-full text-left px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer ${
                                filterStatus === 'low_stock' ? 'font-bold text-yellow-500' : ''
                              }`}
                              onClick={() => {
                                setFilterStatus('low_stock');
                                setShowFilterMenu(false);
                              }}
                            >
                              Abaixo do Mínimo
                            </button>
                            <button
                              className={`w-full text-left px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer ${
                                filterStatus === 'out_of_stock' ? 'font-bold text-red-500' : ''
                              }`}
                              onClick={() => {
                                setFilterStatus('out_of_stock');
                                setShowFilterMenu(false);
                              }}
                            >
                              Sem Estoque
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Table */}
                  <div className="bg-white dark:bg-[#1a1a1b] rounded-xl border border-black/10 dark:border-white/10 overflow-hidden flex-1 flex flex-col shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-50 dark:bg-white/5 border-b border-black/10 dark:border-white/10 text-gray-500 font-semibold select-none">
                          <tr>
                            <th className="p-3 w-12 text-center">
                              <input
                                type="checkbox"
                                checked={allVisibleSelected}
                                onChange={() => toggleSelectAll(filteredProducts)}
                                className="w-4 h-4 rounded text-[#0866ff] focus:ring-[#0866ff] cursor-pointer accent-[#0866ff]"
                                title={allVisibleSelected ? 'Desmarcar todos' : 'Selecionar todos'}
                              />
                            </th>
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
                              <td colSpan={7} className="p-8 text-center text-gray-500">
                                Nenhum produto encontrado.
                              </td>
                            </tr>
                          ) : (
                            filteredProducts.map(product => {
                              const isSelected = selectedIds.has(product.id);
                              return (
                                <tr
                                  key={product.id}
                                  className={`transition-colors ${
                                    isSelected
                                      ? 'bg-blue-50/70 dark:bg-blue-950/30'
                                      : 'hover:bg-black/5 dark:hover:bg-white/5'
                                  }`}
                                >
                                  <td className="p-3 w-12 text-center">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => toggleSelectOne(product.id)}
                                      className="w-4 h-4 rounded text-[#0866ff] focus:ring-[#0866ff] cursor-pointer accent-[#0866ff]"
                                    />
                                  </td>
                                  <td className="p-3 font-mono text-xs">{product.internal_code || '-'}</td>
                                  <td className="p-3 font-semibold text-[#1c1d21] dark:text-white">
                                    {product.name}
                                  </td>
                                  <td className="p-3 text-gray-600 dark:text-gray-300">
                                    {product.al_categories?.name || '-'}
                                  </td>
                                  <td className="p-3 font-bold">
                                    {product.current_quantity}{' '}
                                    <span className="text-xs text-gray-500 font-normal">
                                      {product.unit_of_measure}
                                    </span>
                                  </td>
                                  <td className="p-3">{renderStatus(product.current_quantity, product.min_stock)}</td>
                                  <td className="p-3 flex items-center justify-end gap-1.5">
                                    {canEdit && (
                                      <button
                                        onClick={() => setEditModalProduct(product)}
                                        className="p-1.5 text-gray-500 hover:text-[#0866ff] hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-md transition-colors cursor-pointer"
                                        title="Editar Item"
                                      >
                                        <Edit size={16} />
                                      </button>
                                    )}
                                    <button
                                      className="p-1.5 text-gray-500 hover:text-[#0866ff] hover:bg-gray-100 dark:hover:bg-white/10 rounded-md transition-colors cursor-pointer"
                                      title="Ver Detalhes"
                                    >
                                      <Eye size={16} />
                                    </button>
                                    <button
                                      onClick={() => setUpdateModalConfig({ product, type: 'in' })}
                                      className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-950/40 rounded-md transition-colors cursor-pointer"
                                      title="Dar Entrada"
                                    >
                                      <ArrowDownToLine size={16} />
                                    </button>
                                    <button
                                      onClick={() => setUpdateModalConfig({ product, type: 'out' })}
                                      className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-md transition-colors cursor-pointer"
                                      title="Dar Saída"
                                    >
                                      <ArrowUpFromLine size={16} />
                                    </button>
                                    {canEdit && (
                                      <button
                                        onClick={() => setItemToDelete(product)}
                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-md transition-colors cursor-pointer ml-1"
                                        title="Excluir Item"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>

      {/* Modal de Confirmação de Exclusão Individual */}
      {itemToDelete && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#202022] border border-red-200 dark:border-red-900/50 rounded-2xl p-6 max-w-md w-full shadow-2xl flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mb-4">
              <AlertTriangle size={24} />
            </div>
            <h3 className="text-lg font-bold text-[#1c1d21] dark:text-white mb-2">Excluir Item?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
              Tem certeza que deseja excluir o item{' '}
              <strong className="text-red-600 dark:text-red-400 font-semibold">{itemToDelete.name}</strong>
              {itemToDelete.internal_code ? ` (Cód: ${itemToDelete.internal_code})` : ''}? Esta ação removerá o produto
              do estoque.
            </p>
            <div className="flex items-center gap-3 w-full">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-lg font-bold border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => executeSingleDelete(itemToDelete)}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-lg font-bold bg-red-600 hover:bg-red-700 text-white transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
              >
                {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão em Lote */}
      {showBatchDeleteModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#202022] border border-red-200 dark:border-red-900/50 rounded-2xl p-6 max-w-md w-full shadow-2xl flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mb-4">
              <AlertTriangle size={24} />
            </div>
            <h3 className="text-lg font-bold text-[#1c1d21] dark:text-white mb-2">
              Excluir {selectedIds.size} {selectedIds.size === 1 ? 'Item' : 'Itens'}?
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
              Tem certeza que deseja excluir permanentemente os{' '}
              <strong className="text-red-600 dark:text-red-400 font-semibold">
                {selectedIds.size} {selectedIds.size === 1 ? 'item selecionado' : 'itens selecionados'}
              </strong>{' '}
              do almoxarifado? Esta ação não poderá ser desfeita.
            </p>
            <div className="flex items-center gap-3 w-full">
              <button
                type="button"
                onClick={() => setShowBatchDeleteModal(false)}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-lg font-bold border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={executeBatchDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-lg font-bold bg-red-600 hover:bg-red-700 text-white transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
              >
                {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                Excluir Todos ({selectedIds.size})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Novo Item Modal */}
      {showNewItemModal && (
        <NewItemModal
          onClose={() => setShowNewItemModal(false)}
          onSuccess={() => {
            setShowNewItemModal(false);
            fetchData();
          }}
        />
      )}

      {/* Import Modal */}
      {showImportModal && (
        <ImportStockModal
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            setShowImportModal(false);
            fetchData();
          }}
        />
      )}

      {/* Edit Item Modal */}
      {editModalProduct && (
        <EditItemModal
          product={editModalProduct}
          userName={userName}
          onClose={() => setEditModalProduct(null)}
          onSuccess={() => {
            setEditModalProduct(null);
            fetchData();
          }}
        />
      )}

      {/* Update Stock Modal */}
      {updateModalConfig && (
        <StockUpdateModal
          product={updateModalConfig.product}
          type={updateModalConfig.type}
          onClose={() => setUpdateModalConfig(null)}
          onSuccess={() => {
            setUpdateModalConfig(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="bg-white dark:bg-[#1a1a1b] p-4 rounded-xl border border-black/5 dark:border-white/5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</span>
      <div className="mt-1 metric-value" style={{ fontSize: 'clamp(28px, 7vw, 48px)' }}>
        {value}
      </div>
    </div>
  );
}

const DollarSignIcon = (props: any) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <line x1="12" x2="12" y1="2" y2="22" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);
