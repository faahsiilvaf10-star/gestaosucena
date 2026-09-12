import { useEffect, useState } from 'react'

export function CustomCursor() {
  const [position, setPosition] = useState({ x: -100, y: -100 })
  const [isTouch, setIsTouch] = useState(false)

  useEffect(() => {
    // Detectar se o dispositivo é touch (coarse pointer = touch)
    const touchMedia = window.matchMedia('(pointer: coarse)')
    setIsTouch(touchMedia.matches)

    if (touchMedia.matches) return // Não adicionar listeners em touch devices

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY })
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [])

  // Não renderizar nada em dispositivos touch
  if (isTouch) return null

  return (
    <div 
      className="pointer-events-none fixed top-0 left-0 z-[9999] rounded-full bg-white shadow-[0_0_10px_2px_rgba(255,255,255,0.8),0_0_20px_4px_rgba(255,255,255,0.5)] mix-blend-difference custom-cursor"
      style={{
        width: '6px',
        height: '6px',
        transform: `translate3d(${position.x - 3}px, ${position.y - 3}px, 0)`,
        willChange: 'transform'
      }}
    />
  )
}
