import BadgeCheck from 'lucide-react/dist/esm/icons/badge-check.js';

export function VerifiedBadge({ className = "", size = 16 }: { className?: string, size?: number }) {
  return (
    <BadgeCheck 
      size={size} 
      className={`text-white fill-[#0095F6] shrink-0 ${className}`} 
      style={{ marginLeft: '4px' }}
      title="Verificado"
    />
  )
}

export function isAdmin(name?: string, role?: string) {
  if (!name && !role) return false;
  const n = name?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || '';
  const r = role?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || '';
  // Consider Fabricio Silva as admin, plus any role containing admin but excluding administrativo/administracao
  return n.includes('fabricio silva') || (r.includes('admin') && !r.includes('administrativo') && !r.includes('administracao')) || r.includes('diretor');
}

/**
 * Checks if user can edit almoxarifado items.
 * Admins and Auxiliares Administrativos can edit items.
 */
export function canEditAlmoxarifado(name?: string, role?: string): boolean {
  if (!name && !role) return false;
  const r = role?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || '';
  // Admin users can always edit
  if (isAdmin(name, role)) return true;
  // Auxiliares Administrativos can also edit
  return r.includes('aux') && (r.includes('administrativo') || r.includes('administracao'));
}
