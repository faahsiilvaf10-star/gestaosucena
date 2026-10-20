import { useState } from 'react';
import * as Icons from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// Ícones mais usados para atividades do RDO
const AVAILABLE_ICONS = [
  { name: 'Shovel', label: 'Pá' },
  { name: 'Pickaxe', label: 'Enxada' },
  { name: 'Wrench', label: 'Chave' },
  { name: 'Hammer', label: 'Martelo' },
  { name: 'Scissors', label: 'Tesoura' },
  { name: 'Leaf', label: 'Folha' },
  { name: 'Sprout', label: 'Muda' },
  { name: 'TreePine', label: 'Árvore' },
  { name: 'Flower2', label: 'Flor' },
  { name: 'Droplets', label: 'Água' },
  { name: ' Waves', label: 'Ondas' },
  { name: 'Mountain', label: 'Montanha' },
  { name: 'HardHat', label: 'Capacete' },
  { name: 'Truck', label: 'Caminhão' },
  { name: 'Package', label: 'Pacote' },
  { name: 'Box', label: 'Caixa' },
  { name: 'Ruler', label: 'Régua' },
  { name: 'Maximize2', label: 'Ampliar' },
  { name: 'Minimize2', label: 'Reduzir' },
  { name: 'Move', label: 'Mover' },
  { name: 'RotateCw', label: 'Girar' },
  { name: 'Hammer', label: 'Martelo' },
  { name: 'Zap', label: 'Raio' },
  { name: 'Flame', label: 'Fogo' },
  { name: 'Droplet', label: 'Gota' },
  { name: 'CloudRain', label: 'Chuva' },
  { name: 'Thermometer', label: 'Temperatura' },
  { name: 'Sun', label: 'Sol' },
  { name: 'Moon', label: 'Lua' },
  { name: 'Star', label: 'Estrela' },
  { name: 'Heart', label: 'Coração' },
  { name: 'CheckCircle2', label: 'OK' },
  { name: 'Circle', label: 'Círculo' },
  { name: 'Square', label: 'Quadrado' },
  { name: 'Triangle', label: 'Triângulo' },
  { name: 'Hexagon', label: 'Hexágono' },
  { name: 'Octagon', label: 'Octógono' },
  { name: 'Activity', label: 'Atividade' },
  { name: 'Target', label: 'Alvo' },
  { name: 'Crosshair', label: 'Mira' },
  { name: 'Compass', label: 'Bússola' },
  { name: 'MapPin', label: 'Pin' },
  { name: 'Map', label: 'Mapa' },
  { name: 'Globe', label: 'Globo' },
  { name: 'Navigation', label: 'Navegação' },
  { name: 'Users', label: 'Equipe' },
  { name: 'User', label: 'Usuário' },
  { name: 'UserPlus', label: 'Add Usuário' },
  { name: 'UserCheck', label: 'Check Usuário' },
  { name: 'Clipboard', label: 'Prancheta' },
  { name: 'ClipboardCheck', label: 'Prancheta OK' },
  { name: 'FileText', label: 'Arquivo' },
  { name: 'Folder', label: 'Pasta' },
  { name: 'Archive', label: 'Arquivo' },
  { name: 'Tag', label: 'Tag' },
  { name: 'Flag', label: 'Bandeira' },
  { name: 'AlertCircle', label: 'Alerta' },
  { name: 'AlertTriangle', label: 'Triângulo Alerta' },
  { name: 'Info', label: 'Info' },
  { name: 'HelpCircle', label: 'Ajuda' },
  { name: 'Search', label: 'Buscar' },
  { name: 'Filter', label: 'Filtro' },
  { name: 'Sliders', label: 'Config' },
  { name: 'Settings', label: 'Engrenagem' },
  { name: 'Tool', label: 'Ferramenta' },
  { name: 'Pliers', label: 'Alicate' },
  { name: 'Screwdriver', label: 'Chave Fenda' },
  { name: 'Drill', label: 'Furadeira' },
  { name: 'Paintbrush', label: 'Pincel' },
  { name: 'PaintRoller', label: 'Rolo' },
  { name: 'Bucket', label: 'Balde' },
  { name: 'Warehouse', label: 'Depósito' },
  { name: 'Home', label: 'Casa' },
  { name: 'Building', label: 'Prédio' },
  { name: 'Store', label: 'Loja' },
  { name: 'Factory', label: 'Fábrica' },
  { name: 'Construction', label: 'Construção' },
  { name: 'Hammer', label: 'Construção' },
  { name: 'Briefcase', label: 'Malote' },
  { name: 'Trophy', label: 'Troféu' },
  { name: 'Medal', label: 'Medalha' },
  { name: 'Award', label: 'Prêmio' },
  { name: 'Clock', label: 'Relógio' },
  { name: 'Timer', label: 'Timer' },
  { name: 'Calendar', label: 'Calendário' },
  { name: 'CalendarCheck', label: 'Calendário OK' },
  { name: 'Bell', label: 'Sino' },
  { name: 'BellRing', label: 'Sino Tocando' },
  { name: 'MessageSquare', label: 'Mensagem' },
  { name: 'Mail', label: 'Email' },
  { name: 'Phone', label: 'Telefone' },
  { name: 'Camera', label: 'Câmera' },
  { name: 'Image', label: 'Imagem' },
  { name: 'Video', label: 'Vídeo' },
  { name: 'Mic', label: 'Microfone' },
  { name: 'Speaker', label: 'Alto-falante' },
  { name: 'Music', label: 'Música' },
  { name: 'Headphones', label: 'Fones' },
  { name: 'Radio', label: 'Rádio' },
  { name: 'Tv', label: 'TV' },
  { name: 'Monitor', label: 'Monitor' },
  { name: 'Smartphone', label: 'Celular' },
  { name: 'Tablet', label: 'Tablet' },
  { name: 'Laptop', label: 'Laptop' },
  { name: 'Keyboard', label: 'Teclado' },
  { name: 'Mouse', label: 'Mouse' },
  { name: 'Printer', label: 'Impressora' },
  { name: 'Projector', label: 'Projetor' },
  { name: 'Battery', label: 'Bateria' },
  { name: 'Plug', label: 'Tomada' },
  { name: 'Zap', label: 'Eletricidade' },
  { name: 'Power', label: 'Liga/Desliga' },
  { name: 'Lock', label: 'Cadeado' },
  { name: 'Unlock', label: 'Destrancado' },
  { name: 'Key', label: 'Chave' },
  { name: 'Eye', label: 'Olho' },
  { name: 'EyeOff', label: 'Oculto' },
  { name: 'Scan', label: 'Escanear' },
  { name: 'Barcode', label: 'Código' },
  { name: 'QrCode', label: 'QR Code' },
  { name: 'Link', label: 'Link' },
  { name: 'Share', label: 'Compartilhar' },
  { name: 'Download', label: 'Download' },
  { name: 'Upload', label: 'Upload' },
  { name: 'ExternalLink', label: 'Link Externo' },
  { name: 'Copy', label: 'Copiar' },
  { name: 'Cut', label: 'Recortar' },
  { name: 'Clipboard', label: 'Colar' },
  { name: 'Edit', label: 'Editar' },
  { name: 'Edit3', label: 'Editar 3' },
  { name: 'Pencil', label: 'Lápis' },
  { name: 'Type', label: 'Digitar' },
  { name: 'Bold', label: 'Negrito' },
  { name: 'Italic', label: 'Itálico' },
  { name: 'Underline', label: 'Sublinhado' },
  { name: 'Strikethrough', label: 'Tachado' },
  { name: 'AlignLeft', label: 'Esquerda' },
  { name: 'AlignCenter', label: 'Centro' },
  { name: 'AlignRight', label: 'Direita' },
  { name: 'List', label: 'Lista' },
  { name: 'ListOrdered', label: 'Lista Ordenada' },
  { name: 'Hash', label: 'Hash' },
  { name: 'Plus', label: 'Mais' },
  { name: 'Minus', label: 'Menos' },
  { name: 'Divide', label: 'Dividir' },
  { name: 'Percent', label: 'Porcento' },
  { name: 'PlusCircle', label: 'Mais Círculo' },
  { name: 'MinusCircle', label: 'Menos Círculo' },
  { name: 'XCircle', label: 'X Círculo' },
  { name: 'CheckCircle', label: 'Check Círculo' },
  { name: 'ArrowUp', label: 'Seta Cima' },
  { name: 'ArrowDown', label: 'Seta Baixo' },
  { name: 'ArrowLeft', label: 'Seta Esquerda' },
  { name: 'ArrowRight', label: 'Seta Direita' },
  { name: 'ChevronUp', label: 'Chevron Cima' },
  { name: 'ChevronDown', label: 'Chevron Baixo' },
  { name: 'ChevronLeft', label: 'Chevron Esquerda' },
  { name: 'ChevronRight', label: 'Chevron Direita' },
  { name: 'RefreshCw', label: 'Atualizar' },
  { name: 'RotateCw', label: 'Girar' },
  { name: 'RotateCcw', label: 'Girar Contrário' },
  { name: 'Undo', label: 'Desfazer' },
  { name: 'Redo', label: 'Refazer' },
  { name: 'Play', label: 'Play' },
  { name: 'Pause', label: 'Pause' },
  { name: 'Stop', label: 'Parar' },
  { name: 'SkipBack', label: 'Voltar' },
  { name: 'SkipForward', label: 'Avançar' },
  { name: 'FastForward', label: 'Avanço Rápido' },
  { name: 'Rewind', label: 'Retroceder' },
  { name: 'Square', label: 'Parar' },
  { name: 'Circle', label: 'Círculo' },
  { name: 'Triangle', label: 'Triângulo' },
  { name: 'Maximize', label: 'Maximizar' },
  { name: 'Minimize', label: 'Minimizar' },
  { name: 'ZoomIn', label: 'Mais Zoom' },
  { name: 'ZoomOut', label: 'Menos Zoom' },
  { name: 'Focus', label: 'Foco' },
  { name: 'Aperture', label: 'Abertura' },
  { name: 'Grid', label: 'Grade' },
  { name: 'LayoutGrid', label: 'Layout Grade' },
  { name: 'LayoutList', label: 'Layout Lista' },
  { name: 'LayoutDashboard', label: 'Dashboard' },
  { name: 'PanelLeft', label: 'Painel' },
  { name: 'PanelRight', label: 'Painel Direito' },
  { name: 'Sidebar', label: 'Barra Lateral' },
  { name: 'Menu', label: 'Menu' },
  { name: 'MoreHorizontal', label: 'Mais Opções' },
  { name: 'MoreVertical', label: 'Mais Vertical' },
  { name: 'GripVertical', label: 'Arrastar' },
  { name: 'GripHorizontal', label: 'Arrastar H' },
  { name: 'Layers', label: 'Camadas' },
  { name: 'Layer', label: 'Camada' },
  { name: 'Copy', label: 'Duplicar' },
  { name: 'Trash2', label: 'Lixeira' },
  { name: 'Archive', label: 'Arquivar' },
  { name: 'Inbox', label: 'Inbox' },
  { name: 'Send', label: 'Enviar' },
  { name: 'Paperclip', label: 'Anexo' },
  { name: 'Bookmark', label: 'Favorito' },
  { name: 'BookOpen', label: 'Livro Aberto' },
  { name: 'Book', label: 'Livro' },
  { name: 'Newspaper', label: 'Jornal' },
  { name: 'FilePlus', label: 'Novo Arquivo' },
  { name: 'FileMinus', label: 'Menos Arquivo' },
  { name: 'FolderPlus', label: 'Nova Pasta' },
  { name: 'FolderMinus', label: 'Menos Pasta' },
  { name: 'Trash', label: 'Lixeira' },
  { name: 'Ban', label: 'Proibido' },
  { name: 'Shield', label: 'Escudo' },
  { name: 'ShieldCheck', label: 'Escudo OK' },
  { name: 'ShieldAlert', label: 'Escudo Alerta' },
  { name: 'ShieldX', label: 'Escudo X' },
  { name: 'ShieldPlus', label: 'Escudo Mais' },
  { name: 'Bug', label: 'Bug' },
  { name: 'Code', label: 'Código' },
  { name: 'Terminal', label: 'Terminal' },
  { name: 'Cpu', label: 'CPU' },
  { name: 'Server', label: 'Servidor' },
  { name: 'Database', label: 'Banco' },
  { name: 'HardDrive', label: 'HD' },
  { name: 'Cloud', label: 'Nuvem' },
  { name: 'CloudOff', label: 'Nuvem Off' },
  { name: 'CloudRain', label: 'Nuvem Chuva' },
  { name: 'CloudSnow', label: 'Nuvem Neve' },
  { name: 'CloudLightning', label: 'Nuvem Trovão' },
  { name: 'Wind', label: 'Vento' },
  { name: 'Snowflake', label: 'Neve' },
  { name: 'Umbrella', label: 'Guarda-chuva' },
  { name: 'SunSnow', label: 'Sol Neve' },
  { name: 'MoonStar', label: 'Lua Estrela' },
  { name: 'Sunrise', label: 'Nascer Sol' },
  { name: 'Sunset', label: 'Pôr Sol' },
  { name: 'SunMedium', label: 'Sol Médio' },
  { name: 'Moon', label: 'Lua' },
  { name: 'Sparkles', label: 'Brilhos' },
  { name: 'Sparkle', label: 'Brilho' },
  { name: 'Rocket', label: 'Foguete' },
  { name: 'Plane', label: 'Avião' },
  { name: 'Car', label: 'Carro' },
  { name: 'Bike', label: 'Bicicleta' },
  { name: 'Ship', label: 'Barco' },
  { name: 'TrainFront', label: 'Trem' },
  { name: 'Bus', label: 'Ônibus' },
  { name: 'Footprints', label: 'Pegadas' },
  { name: 'Accessibility', label: 'Acessibilidade' },
  { name: 'Baby', label: 'Bebê' },
  { name: 'Dog', label: 'Cachorro' },
  { name: 'Cat', label: 'Gato' },
  { name: 'Bird', label: 'Pássaro' },
  { name: 'Fish', label: 'Peixe' },
  { name: 'Bug', label: 'Inseto' },
  { name: 'Flower', label: 'Flor' },
  { name: 'TreeDeciduous', label: 'Árvore Decídua' },
  { name: 'TreePine', label: 'Pinheiro' },
  { name: 'Mountain', label: 'Montanha' },
  { name: 'Hill', label: 'Colina' },
  { name: 'Waves', label: 'Ondas' },
  { name: 'Wheat', label: 'Trigo' },
  { name: 'Leaf', label: 'Folha' },
  { name: 'Cherry', label: 'Cereja' },
  { name: 'Apple', label: 'Maçã' },
  { name: 'Banana', label: 'Banana' },
  { name: 'Grape', label: 'Uva' },
  { name: 'Carrot', label: 'Cenoura' },
  { name: 'Salad', label: 'Salada' },
  { name: 'Coffee', label: 'Café' },
  { name: 'Beer', label: 'Cerveja' },
  { name: 'Wine', label: 'Vinho' },
  { name: 'CupSoda', label: 'Copo' },
  { name: 'GlassWater', label: 'Água' },
  { name: 'Pizza', label: 'Pizza' },
  { name: 'Cake', label: 'Bolo' },
  { name: 'Cookie', label: 'Biscoito' },
  { name: 'Apple', label: 'Maçã' },
  { name: 'Candy', label: 'Doce' },
  { name: 'Milk', label: 'Leite' },
  { name: 'Cookie', label: 'Biscoito' },
  { name: 'ChefHat', label: 'Chef' },
  { name: 'UtensilsCrossed', label: 'Talheres' },
  { name: 'Knife', label: 'Faca' },
  { name: 'Spoon', label: 'Colher' },
  { name: 'Fork', label: 'Garfo' },
  { name: 'Pizza', label: 'Pizza' },
  { name: 'Sandwich', label: 'Sanduíche' },
  { name: 'Burger', label: 'Hambúrguer' },
  { name: 'Hotdog', label: 'Cachorro-quente' },
  { name: 'Popcorn', label: 'Pipoca' },
  { name: 'IceCream', label: 'Sorvete' },
  { name: 'Candy', label: 'Doce' },
  { name: 'Lollipop', label: 'Pirulito' },
  { name: 'Chocolate', label: 'Chocolate' },
  { name: 'Mug', label: 'Caneca' },
  { name: 'Beer', label: 'Cerveja' },
  { name: 'Wine', label: 'Vinho' },
  { name: 'GlassMartini', label: 'Martini' },
  { name: 'Crown', label: 'Coroa' },
  { name: 'Gem', label: 'Gema' },
  { name: 'Diamond', label: 'Diamante' },
  { name: 'Medal', label: 'Medalha' },
  { name: 'Trophy', label: 'Troféu' },
  { name: 'Award', label: 'Prêmio' },
  { name: 'Gift', label: 'Presente' },
  { name: 'Heart', label: 'Coração' },
  { name: 'HeartPulse', label: 'Coração Pulso' },
  { name: 'Stethoscope', label: 'Estetoscópio' },
  { name: 'Syringe', label: 'Seringa' },
  { name: 'Pill', label: 'Remédio' },
  { name: 'Bandage', label: 'Bandagem' },
  { name: 'Thermometer', label: 'Termômetro' },
  { name: 'Activity', label: 'Atividade' },
  { name: 'TrendingUp', label: 'Subindo' },
  { name: 'TrendingDown', label: 'Descendo' },
  { name: 'DollarSign', label: 'Dólar' },
  { name: 'Euro', label: 'Euro' },
  { name: 'PoundSterling', label: 'Libra' },
  { name: 'Bitcoin', label: 'Bitcoin' },
  { name: 'CreditCard', label: 'Cartão' },
  { name: 'Wallet', label: 'Carteira' },
  { name: 'ShoppingCart', label: 'Carrinho' },
  { name: 'ShoppingBag', label: 'Sacola' },
  { name: 'Gift', label: 'Presente' },
  { name: 'Receipt', label: 'Recibo' },
  { name: 'BarChart', label: 'Gráfico Barras' },
  { name: 'PieChart', label: 'Gráfico Pizza' },
  { name: 'LineChart', label: 'Gráfico Linha' },
  { name: 'ChartLine', label: 'Linha' },
  { name: 'ChartBar', label: 'Barras' },
  { name: 'ChartPie', label: 'Pizza' },
  { name: 'TrendingUp', label: 'Tendência' },
  { name: 'Gauge', label: 'Velocímetro' },
  { name: 'Speedometer', label: 'Medidor' },
  { name: 'Gauge', label: 'Manômetro' },
  { name: 'Timer', label: 'Timer' },
  { name: 'Clock', label: 'Relógio' },
  { name: 'Hourglass', label: 'Ampulheta' },
  { name: 'Watch', label: 'Relógio Pulso' },
  { name: 'AlarmClock', label: 'Despertador' },
  { name: 'Bell', label: 'Sino' },
  { name: 'BellRing', label: 'Sino Tocando' },
  { name: 'BellOff', label: 'Sino Off' },
  { name: 'Megaphone', label: 'Megafone' },
  { name: 'Loudspeaker', label: 'Alto-falante' },
  { name: 'Volume1', label: 'Volume 1' },
  { name: 'Volume2', label: 'Volume 2' },
  { name: 'VolumeX', label: 'Mudo' },
  { name: 'Mic', label: 'Mic' },
  { name: 'MicOff', label: 'Mic Off' },
];

interface IconPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (iconName: string) => void;
  currentIcon?: string;
}

export function IconPicker({ isOpen, onClose, onSelect, currentIcon = 'Activity' }: IconPickerProps) {
  const [search, setSearch] = useState('');

  const filteredIcons = AVAILABLE_ICONS.filter(icon =>
    icon.label.toLowerCase().includes(search.toLowerCase()) ||
    icon.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (iconName: string) => {
    onSelect(iconName);
    onClose();
  };

  const renderIcon = (iconName: string) => {
    const IconComponent = (Icons as any)[iconName];
    if (!IconComponent) {
      return <Icons.Activity size={20} />;
    }
    return <IconComponent size={20} />;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Selecionar Ícone</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Buscar ícone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-yellow-500 transition-colors"
          />
        </div>

        <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 overflow-y-auto flex-1 p-1">
          {filteredIcons.map((icon) => (
            <button
              key={icon.name}
              onClick={() => handleSelect(icon.name)}
              className={`aspect-square flex flex-col items-center justify-center rounded-xl transition-all duration-200 gap-1.5 p-2
                ${currentIcon === icon.name
                  ? 'bg-yellow-100 border-2 border-yellow-500 text-yellow-700'
                  : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-yellow-50 hover:border-yellow-300 hover:text-yellow-600'
                }`}
              title={icon.label}
            >
              <span className="flex items-center justify-center">
                {renderIcon(icon.name)}
              </span>
              <span className="text-[10px] text-center leading-tight truncate w-full">
                {icon.label}
              </span>
            </button>
          ))}
        </div>

        {filteredIcons.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Nenhum ícone encontrado para "{search}"
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Componente compacto para seleção rápida
interface IconSelectorProps {
  value: string;
  onChange: (iconName: string) => void;
  size?: 'sm' | 'md' | 'lg';
}

export function IconSelector({ value, onChange, size = 'md' }: IconSelectorProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12'
  };

  const IconComponent = (Icons as any)[value];
  const renderedIcon = IconComponent ? <IconComponent size={size === 'sm' ? 16 : size === 'md' ? 20 : 24} /> : <Icons.Activity size={size === 'sm' ? 16 : size === 'md' ? 20 : 24} />;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsPickerOpen(true)}
        className={`${sizes[size]} flex items-center justify-center rounded-xl bg-gray-50 border border-gray-200 text-gray-600 hover:bg-yellow-50 hover:border-yellow-300 hover:text-yellow-600 transition-all duration-200`}
      >
        {renderedIcon}
      </button>

      <IconPicker
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelect={onChange}
        currentIcon={value}
      />
    </>
  );
}
