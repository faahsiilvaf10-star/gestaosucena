import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
import Globe from 'lucide-react/dist/esm/icons/globe.js';
import ExternalLink from 'lucide-react/dist/esm/icons/external-link.js';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { SafetyBanner, getSafetyBanners, saveSafetyBanners, resolveBannerUrl, isExternalUrl } from '../lib/safetyBanners';
import { useTheme } from '../contexts/ThemeContext';

interface SafetyBannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: (banners: SafetyBanner[]) => void;
  initialBannerId?: string | null;
}

export function SafetyBannerModal({ isOpen, onClose, onUpdated, initialBannerId }: SafetyBannerModalProps) {
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
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Trava o scroll de fundo e adiciona listener para tecla ESC
  useEffect(() => {
    if (!isOpen) return;

    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Load banners on open
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    getSafetyBanners().then(data => {
      setBanners(data);
      setLoading(false);
      if (initialBannerId) {
        const found = data.find(b => b.id === initialBannerId);
        if (found) {
          handleStartEdit(found);
        }
      }
    });
  }, [isOpen, initialBannerId]);

  // Open edit form for a banner
  const handleStartEdit = (b: SafetyBanner) => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
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
    if (contentRef.current) contentRef.current.scrollTop = 0;
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

  // Processamento e Upload de Imagem (com Storage + Otimização Canvas resiliente)
  const handleImageFile = async (file: File) => {
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
        toast.success('Foto enviada com sucesso!');
        setUploadingImage(false);
        return;
      }
    } catch (err) {
      console.warn('[SafetyBannerModal] Storage retornou erro, gerando fallback otimizado:', err);
    }

    // 2. Fallback resiliente com Canvas para não estourar memória
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const MAX_WIDTH = 1280;
          const MAX_HEIGHT = 720;
          let width = img.width;
          let height = img.height;

          if (width > MAX_WIDTH || height > MAX_HEIGHT) {
            if (width / height > MAX_WIDTH / MAX_HEIGHT) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            } else {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            setImageUrl(dataUrl);
            toast.success('Foto carregada com sucesso!');
            setUploadingImage(false);
            return;
          }
          setImageUrl(reader.result as string);
          setUploadingImage(false);
        };
        img.onerror = () => {
          setImageUrl(reader.result as string);
          setUploadingImage(false);
        };
        img.src = e.target?.result as string;
      };
      reader.onerror = () => {
        toast.error('Erro ao ler o arquivo de imagem.');
        setUploadingImage(false);
      };
      reader.readAsDataURL(file);
    } catch (_) {
      setUploadingImage(false);
    }
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageFile(file);
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

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col my-auto max-h-[90vh] transition-all animate-in zoom-in-95 duration-200 ${
          isDark ? 'bg-[#121316] border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900'
        }`}
        onClick={(e) => e.stopPropagation()}
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
        <div ref={contentRef} className="p-6 overflow-y-auto space-y-6 flex-1">
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
                  <div className="pt-1.5 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (buttonLink.trim()) {
                          const { url, isExternal } = resolveBannerUrl(buttonLink);
                          if (isExternal) {
                            window.open(url, '_blank', 'noopener,noreferrer');
                          } else {
                            toast.info(`Rota interna: ${url}`);
                          }
                        } else {
                          toast.info('Nenhuma URL configurada (padrão: /seguranca/dds)');
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#D6A72B] hover:bg-[#c29623] text-black transition-all cursor-pointer shadow-sm active:scale-95"
                      title={buttonLink.trim() ? `Clique para testar: ${resolveBannerUrl(buttonLink).url}` : 'Clique para testar'}
                    >
                      <span>{buttonText || 'Juntos somos mais fortes'}</span>
                      {buttonLink && isExternalUrl(buttonLink) ? (
                        <ExternalLink size={12} />
                      ) : (
                        <span>→</span>
                      )}
                    </button>
                    {buttonLink.trim() && (
                      <span className="text-[10px] text-gray-300 bg-black/50 px-2 py-0.5 rounded-full truncate max-w-[220px] backdrop-blur-xs flex items-center gap-1">
                        <Globe size={10} className="text-[#D6A72B] shrink-0" />
                        <span className="truncate">{resolveBannerUrl(buttonLink).url}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Upload da Foto do Banner com Card Destacado */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                    <ImageIcon size={16} className="text-[#D6A72B]" />
                    Foto / Imagem do Banner
                  </label>
                  {imageUrl && imageUrl !== '/safety-helmet.webp' && (
                    <button
                      type="button"
                      onClick={() => setImageUrl('/safety-helmet.webp')}
                      className="text-[11px] text-gray-500 hover:text-amber-600 dark:hover:text-amber-400 font-medium underline cursor-pointer"
                    >
                      Restaurar foto padrão (Capacete)
                    </button>
                  )}
                </div>

                {/* Dropzone e Botão de Upload em Alto Contraste */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleImageFile(file);
                  }}
                  className={`relative p-4 rounded-2xl border-2 border-dashed transition-all flex flex-col sm:flex-row items-center gap-4 ${
                    isDragging
                      ? 'border-[#D6A72B] bg-[#D6A72B]/10'
                      : isDark
                      ? 'border-white/20 bg-white/5 hover:border-white/35'
                      : 'border-amber-400 bg-amber-50/60 hover:border-amber-500'
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageFileChange}
                    accept="image/*"
                    className="hidden"
                  />

                  {/* Thumbnail de Preview */}
                  <div className="w-20 h-14 rounded-xl overflow-hidden bg-black/40 shrink-0 relative border border-black/10 dark:border-white/10 shadow-xs">
                    <img
                      src={imageUrl || '/safety-helmet.webp'}
                      alt="Preview da foto do banner"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Instruções */}
                  <div className="flex-1 text-center sm:text-left">
                    <div className="text-xs font-extrabold text-gray-900 dark:text-white">
                      {uploadingImage ? 'Processando e enviando imagem...' : 'Escolha uma foto do seu computador ou celular'}
                    </div>
                    <div className="text-[11px] text-gray-600 dark:text-gray-400 mt-0.5">
                      Arraste e solte aqui ou clique no botão ao lado • JPG, PNG, WEBP (1200x600)
                    </div>
                  </div>

                  {/* Botão de Upload Dourado / Alto Contraste */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black bg-[#D6A72B] hover:bg-[#b88c1f] text-black transition-all shadow-md active:scale-95 cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    <UploadCloud size={16} />
                    <span>{uploadingImage ? 'Enviando...' : 'Fazer Upload de Foto'}</span>
                  </button>
                </div>

                {/* Opção secundária para URL manual */}
                <div className="pt-1">
                  <details className="text-xs group">
                    <summary className="text-[11px] text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 font-medium select-none">
                      ▸ Ou digitar / colar link de imagem manual
                    </summary>
                    <div className="mt-1.5">
                      <input
                        type="text"
                        value={imageUrl}
                        onChange={e => setImageUrl(e.target.value)}
                        placeholder="Ex: /safety-helmet.webp ou https://exemplo.com/foto.jpg"
                        className={`w-full px-3 py-2 rounded-lg border text-xs outline-none ${
                          isDark ? 'bg-black/30 border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-black'
                        }`}
                      />
                    </div>
                  </details>
                </div>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                      <Globe size={14} className="text-[#D6A72B]" />
                      Link / URL do Site (Botão Amarelo)
                    </label>
                    {buttonLink.trim() && (
                      <button
                        type="button"
                        onClick={() => {
                          const { url, isExternal } = resolveBannerUrl(buttonLink);
                          if (isExternal) {
                            window.open(url, '_blank', 'noopener,noreferrer');
                          } else {
                            window.open(url, '_blank');
                          }
                        }}
                        className="inline-flex items-center gap-1 text-[11px] text-[#D6A72B] hover:underline font-bold cursor-pointer"
                        title="Abrir este link para testar em nova aba"
                      >
                        <ExternalLink size={12} /> Testar Link
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={buttonLink}
                    onChange={e => setButtonLink(e.target.value)}
                    placeholder="Ex: https://seusite.com.br, www.google.com ou /seguranca/dds"
                    className={`w-full px-3 py-2 rounded-lg border text-xs outline-none transition-colors ${
                      isDark ? 'bg-black/30 border-white/10 text-white focus:border-[#D6A72B]' : 'bg-gray-50 border-gray-200 text-black focus:border-[#D6A72B]'
                    }`}
                  />
                  <div className="flex items-center justify-between text-[11px] pt-0.5">
                    <span className="text-gray-500 dark:text-gray-400">
                      Cole a URL do site desejado ou rota interna.
                    </span>
                    {buttonLink.trim() && (
                      <span className={`font-semibold ${isExternalUrl(buttonLink) ? 'text-blue-500 dark:text-blue-400' : 'text-emerald-500 dark:text-emerald-400'}`}>
                        {isExternalUrl(buttonLink) ? '🌐 Site Externo' : '📁 Rota Interna'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5 sm:pt-1">
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400">
                    Visibilidade no Carrossel
                  </label>
                  <div className="flex items-center gap-3 pt-1">
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
    </div>,
    document.body
  );
}

