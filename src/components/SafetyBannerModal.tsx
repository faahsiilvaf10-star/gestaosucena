import React, { useState, useEffect, useRef } from 'react';
import X from 'lucide-react/dist/esm/icons/x.js';
import Plus from 'lucide-react/dist/esm/icons/plus.js';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2.js';
import Pen from 'lucide-react/dist/esm/icons/pen.js';
import ArrowUp from 'lucide-react/dist/esm/icons/arrow-up.js';
import ArrowDown from 'lucide-react/dist/esm/icons/arrow-down.js';
import Check from 'lucide-react/dist/esm/icons/check.js';
import ImageIcon from 'lucide-react/dist/esm/icons/image.js';
import UploadCloud from 'lucide-react/dist/esm/icons/cloud-upload.js';
import Shield from 'lucide-react/dist/esm/icons/shield.js';
import Eye from 'lucide-react/dist/esm/icons/eye.js';
import EyeOff from 'lucide-react/dist/esm/icons/eye-off.js';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { SafetyBanner, getSafetyBanners, saveSafetyBanners } from '../lib/safetyBanners';
import { useTheme } from '../contexts/ThemeContext';

interface SafetyBannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: (banners: SafetyBanner[]) => void;
}

export function SafetyBannerModal({ isOpen, onClose, onUpdated }: SafetyBannerModalProps) {
  const { isDark } = useTheme();
  const [banners, setBanners] = useState<SafetyBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingBanner, setEditingBanner] = useState<SafetyBanner | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form fields
  const [kicker, setKicker] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [buttonText, setButtonText] = useState('');
  const [buttonLink, setButtonLink] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [active, setActive] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load banners on open
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    getSafetyBanners().then(data => {
      setBanners(data);
      setLoading(false);
    });
  }, [isOpen]);

  // Open edit form for a banner
  const handleStartEdit = (b: SafetyBanner) => {
    setEditingBanner(b);
    setIsCreating(false);
    setKicker(b.kicker);
    setTitle(b.title);
    setDescription(b.description);
    setButtonText(b.buttonText);
    setButtonLink(b.buttonLink || '');
    setImageUrl(b.imageUrl);
    setActive(b.active);
  };

  // Open new banner form
  const handleStartCreate = () => {
    setIsCreating(true);
    setEditingBanner(null);
    setKicker('NOSSA PRIORIDADE');
    setTitle('Segurança em primeiro lugar');
    setDescription('Trabalhar com segurança é cuidar de você, da sua família e do nosso futuro.');
    setButtonText('Juntos somos mais fortes');
    setButtonLink('/seguranca/dds');
    setImageUrl('/safety-helmet.webp');
    setActive(true);
  };

  // Cancel edit
  const handleCancelForm = () => {
    setEditingBanner(null);
    setIsCreating(false);
  };

  // Handle local image file upload
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione um arquivo de imagem válido (PNG, JPG, WEBP).');
      return;
    }

    setUploadingImage(true);

    try {
      // 1. Tenta upload no Supabase Storage (bucket 'posts')
      const ext = file.name.split('.').pop() || 'png';
      const fileName = `banner-safety-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      const filePath = `safety-banners/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('posts')
        .upload(filePath, file, { upsert: true });

      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage
          .from('posts')
          .getPublicUrl(filePath);

        setImageUrl(publicUrl);
        toast.success('Imagem carregada com sucesso!');
        setUploadingImage(false);
        return;
      }
    } catch (err) {
      console.warn('[SafetyBannerModal] Falha no storage, convertendo para base64:', err);
    }

    // 2. Fallback resiliente: Converte para Base64 Data URL (funciona sempre)
    const reader = new FileReader();
    reader.onload = () => {
      setImageUrl(reader.result as string);
      toast.success('Imagem carregada localmente!');
      setUploadingImage(false);
    };
    reader.onerror = () => {
      toast.error('Erro ao ler a imagem.');
      setUploadingImage(false);
    };
    reader.readAsDataURL(file);
  };

  // Save current banner form
  const handleSaveForm = async () => {
    if (!title.trim()) {
      toast.error('O título do banner é obrigatório.');
      return;
    }
    if (!imageUrl.trim()) {
      toast.error('A imagem do banner é obrigatória.');
      return;
    }

    let updatedList: SafetyBanner[] = [];

    if (isCreating) {
      const newBanner: SafetyBanner = {
        id: `safety-banner-${Date.now()}`,
        kicker: kicker.trim() || 'NOSSA PRIORIDADE',
        title: title.trim(),
        description: description.trim(),
        buttonText: buttonText.trim() || 'Saiba Mais',
        buttonLink: buttonLink.trim() || '',
        imageUrl: imageUrl.trim(),
        active,
        order: banners.length + 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      updatedList = [...banners, newBanner];
    } else if (editingBanner) {
      updatedList = banners.map(b => {
        if (b.id === editingBanner.id) {
          return {
            ...b,
            kicker: kicker.trim() || 'NOSSA PRIORIDADE',
            title: title.trim(),
            description: description.trim(),
            buttonText: buttonText.trim() || 'Saiba Mais',
            buttonLink: buttonLink.trim() || '',
            imageUrl: imageUrl.trim(),
            active,
            updatedAt: new Date().toISOString()
          };
        }
        return b;
      });
    }

    setSaving(true);
    const success = await saveSafetyBanners(updatedList);
    setSaving(false);

    if (success) {
      setBanners(updatedList);
      setIsCreating(false);
      setEditingBanner(null);
      toast.success(isCreating ? 'Novo banner adicionado!' : 'Banner atualizado com sucesso!');
      if (onUpdated) onUpdated(updatedList);
    } else {
      toast.error('Erro ao salvar no servidor. Alterações salvas localmente.');
      setBanners(updatedList);
      setIsCreating(false);
      setEditingBanner(null);
    }
  };

  // Toggle active status
  const handleToggleActive = async (id: string) => {
    const updated = banners.map(b => (b.id === id ? { ...b, active: !b.active } : b));
    setBanners(updated);
    await saveSafetyBanners(updated);
    if (onUpdated) onUpdated(updated);
  };

  // Delete banner
  const handleDelete = async (id: string) => {
    if (banners.length <= 1) {
      toast.error('Você deve manter pelo menos um banner cadastrado.');
      return;
    }
    if (!window.confirm('Tem certeza que deseja remover este banner?')) return;

    const updated = banners.filter(b => b.id !== id);
    setBanners(updated);
    await saveSafetyBanners(updated);
    toast.success('Banner removido!');
    if (onUpdated) onUpdated(updated);
  };

  // Move up/down in carousel order
  const handleMove = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === banners.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const newBanners = [...banners];
    const temp = newBanners[index];
    newBanners[index] = newBanners[targetIndex];
    newBanners[targetIndex] = temp;

    // Recalcular ordens
    const ordered = newBanners.map((b, idx) => ({ ...b, order: idx + 1 }));
    setBanners(ordered);
    await saveSafetyBanners(ordered);
    if (onUpdated) onUpdated(ordered);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div
        className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col my-8 max-h-[90vh] ${
          isDark ? 'bg-[#121316] border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#D6A72B]/15 text-[#D6A72B]">
              <Shield size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">
                Gerenciar Banners de Segurança
              </h3>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Acesso exclusivo: Técnico de Segurança, Preposto e Administrador
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              isDark ? 'hover:bg-white/10 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-black'
            }`}
          >
            <X size={18} />
          </button>
        </div>

        {/* Info banner */}
        <div className="bg-[#D6A72B]/10 border-b border-[#D6A72B]/20 px-5 py-2.5 flex items-center justify-between">
          <p className="text-xs text-[#D6A72B] font-medium flex items-center gap-2">
            <span>⏱️</span>
            <span>Carrossel automático: passa para o próximo banner a cada <strong>10 segundos</strong>.</span>
          </p>
          {!isCreating && !editingBanner && (
            <button
              type="button"
              onClick={handleStartCreate}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-[#D6A72B] text-black hover:bg-[#c29623] transition-colors shadow-sm"
            >
              <Plus size={14} /> Adicionar Banner
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {loading ? (
            <div className="py-12 text-center text-sm text-gray-400">Carregando banners...</div>
          ) : isCreating || editingBanner ? (
            /* FORM DE CRIAÇÃO / EDIÇÃO */
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <h4 className="font-bold text-sm text-[#D6A72B]">
                  {isCreating ? '➕ Adicionar Novo Banner' : '✏️ Editar Informações do Banner'}
                </h4>
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="text-xs text-gray-400 hover:text-white hover:underline"
                >
                  Voltar para lista
                </button>
              </div>

              {/* Preview em tempo real */}
              <div className="relative rounded-xl overflow-hidden min-h-[190px] flex items-end p-4 shadow-lg border border-white/15">
                <img
                  src={imageUrl || '/safety-helmet.webp'}
                  alt="Preview"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                <div className="relative z-10 space-y-1 text-white">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#D6A72B]">
                    {kicker || 'NOSSA PRIORIDADE'}
                  </span>
                  <h4 className="text-base font-extrabold leading-tight">
                    {title || 'Título do Banner'}
                  </h4>
                  <p className="text-xs text-gray-200 line-clamp-2 max-w-md">
                    {description || 'Descrição informativa de segurança...'}
                  </p>
                  <div className="pt-1.5">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#D6A72B] text-black">
                      {buttonText || 'Juntos somos mais fortes'} →
                    </span>
                  </div>
                </div>
              </div>

              {/* Upload da Foto */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold">Foto / Imagem do Banner</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={imageUrl}
                    onChange={e => setImageUrl(e.target.value)}
                    placeholder="URL da imagem ou clique em Enviar Foto..."
                    className={`flex-1 px-3.5 py-2.5 rounded-lg border text-xs outline-none ${
                      isDark ? 'bg-black/30 border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-black'
                    }`}
                  />
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-colors shrink-0"
                  >
                    <UploadCloud size={14} />
                    {uploadingImage ? 'Enviando...' : 'Enviar Foto'}
                  </button>
                </div>
                <p className="text-[11px] text-gray-500">
                  Dica: imagens horizontais em alta resolução (ex: 1200x600) ficam perfeitas no banner.
                </p>
              </div>

              {/* Kicker / Badge */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold">Tag Superior (Kicker)</label>
                  <input
                    type="text"
                    value={kicker}
                    onChange={e => setKicker(e.target.value)}
                    placeholder="Ex: NOSSA PRIORIDADE"
                    className={`w-full px-3 py-2 rounded-lg border text-xs outline-none ${
                      isDark ? 'bg-black/30 border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-black'
                    }`}
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold">Texto do Botão (CTA)</label>
                  <input
                    type="text"
                    value={buttonText}
                    onChange={e => setButtonText(e.target.value)}
                    placeholder="Ex: Juntos somos mais fortes"
                    className={`w-full px-3 py-2 rounded-lg border text-xs outline-none ${
                      isDark ? 'bg-black/30 border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-black'
                    }`}
                  />
                </div>
              </div>

              {/* Título Principal */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold">Título Principal</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Ex: Segurança em primeiro lugar"
                  className={`w-full px-3 py-2 rounded-lg border text-xs outline-none ${
                    isDark ? 'bg-black/30 border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-black'
                  }`}
                />
              </div>

              {/* Descrição */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold">Descrição do Card</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Ex: Trabalhar com segurança é cuidar de você, da sua família e do nosso futuro."
                  className={`w-full px-3 py-2 rounded-lg border text-xs outline-none resize-none ${
                    isDark ? 'bg-black/30 border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-black'
                  }`}
                />
              </div>

              {/* Link e Ativo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold">Link ao Clicar no Botão (opcional)</label>
                  <input
                    type="text"
                    value={buttonLink}
                    onChange={e => setButtonLink(e.target.value)}
                    placeholder="Ex: /seguranca/dds ou /seguranca/campanhas"
                    className={`w-full px-3 py-2 rounded-lg border text-xs outline-none ${
                      isDark ? 'bg-black/30 border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-black'
                    }`}
                  />
                </div>

                <div className="flex items-center gap-3 pt-4 sm:pt-0">
                  <button
                    type="button"
                    onClick={() => setActive(!active)}
                    className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                      active ? 'bg-[#D6A72B]' : 'bg-gray-600'
                    }`}
                  >
                    <div
                      className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                        active ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="text-xs font-semibold">
                    {active ? 'Banner Ativo no Carrossel' : 'Banner Inativo (Oculto)'}
                  </span>
                </div>
              </div>

              {/* Ações do Form */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="px-4 py-2 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-gray-300 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveForm}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-bold bg-[#D6A72B] hover:bg-[#c29623] text-black transition-colors shadow-md disabled:opacity-50"
                >
                  <Check size={14} />
                  {saving ? 'Salvando...' : 'Salvar Banner'}
                </button>
              </div>
            </div>
          ) : (
            /* LISTAGEM DOS BANNERS */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Banners Cadastrados ({banners.length})
                </span>
                <span className="text-xs text-gray-500">
                  Dica: use as setas para definir a ordem de exibição.
                </span>
              </div>

              {banners.map((b, idx) => (
                <div
                  key={b.id}
                  className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl border transition-all ${
                    isDark ? 'bg-black/30 border-white/10 hover:border-white/20' : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Thumbnail */}
                    <div className="w-16 h-12 rounded-lg overflow-hidden bg-black shrink-0 relative border border-white/10">
                      <img
                        src={b.imageUrl}
                        alt={b.title}
                        className="w-full h-full object-cover"
                      />
                      {!b.active && (
                        <div className="absolute inset-0 bg-black/70 flex items-center justify-center text-[10px] text-gray-300 font-bold">
                          Inativo
                        </div>
                      )}
                    </div>

                    {/* Textos */}
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-extrabold uppercase text-[#D6A72B]">
                          {b.kicker}
                        </span>
                        {!b.active && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-gray-500/20 text-gray-400 font-medium">
                            Oculto
                          </span>
                        )}
                      </div>
                      <h5 className="font-bold text-sm truncate max-w-xs sm:max-w-md">
                        {b.title}
                      </h5>
                      <p className="text-xs text-gray-400 line-clamp-1 max-w-xs sm:max-w-md">
                        {b.description}
                      </p>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMove(idx, 'up')}
                      disabled={idx === 0}
                      className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-30 transition-colors"
                      title="Mover para cima"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMove(idx, 'down')}
                      disabled={idx === banners.length - 1}
                      className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-30 transition-colors"
                      title="Mover para baixo"
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(b.id)}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-gray-300 transition-colors"
                      title={b.active ? 'Ocultar banner' : 'Ativar banner'}
                    >
                      {b.active ? <Eye size={14} className="text-emerald-400" /> : <EyeOff size={14} className="text-gray-500" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStartEdit(b)}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-blue-400 transition-colors"
                      title="Editar foto e textos"
                    >
                      <Pen size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(b.id)}
                      disabled={banners.length <= 1}
                      className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 disabled:opacity-30 transition-colors"
                      title="Excluir banner"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 flex items-center justify-between bg-black/10">
          <span className="text-xs text-gray-400">
            {banners.filter(b => b.active).length} banner(s) ativo(s) no carrossel de 10s
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/15 text-white transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

