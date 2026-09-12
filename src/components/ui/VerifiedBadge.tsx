import { BadgeCheck } from 'lucide-react'

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
  // Consider Fabricio Silva as admin, plus any role containing admin
  return n.includes('fabricio silva') || r.includes('admin') || r.includes('diretor');
}
