import { useState, useEffect, useCallback, useRef, type RefObject } from 'react'

/**
 * Hook para detectar o tamanho da tela atual
 */
export function useBreakpoint() {
  const [breakpoint, setBreakpoint] = useState<'mobile' | 'tablet' | 'desktop' | 'wide'>('desktop')
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      setWindowSize({ width, height })

      if (width < 640) {
        setBreakpoint('mobile')
      } else if (width < 768) {
        setBreakpoint('tablet')
      } else if (width < 1024) {
        setBreakpoint('desktop')
      } else {
        setBreakpoint('wide')
      }
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return { breakpoint, windowSize }
}

/**
 * Hook para detectar se é touch device
 */
export function useIsTouchDevice() {
  const [isTouch, setIsTouch] = useState(false)

  useEffect(() => {
    setIsTouch(
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      window.matchMedia('(pointer: coarse)').matches
    )
  }, [])

  return isTouch
}

/**
 * Hook para detectar orientação
 */
export function useOrientation() {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait')

  useEffect(() => {
    const updateOrientation = () => {
      setOrientation(window.innerHeight > window.innerWidth ? 'portrait' : 'landscape')
    }

    updateOrientation()
    window.addEventListener('resize', updateOrientation)
    return () => window.removeEventListener('resize', updateOrientation)
  }, [])

  return orientation
}

/**
 * Hook para throttle de eventos de resize
 */
export function useThrottledResize(callback: (size: { width: number; height: number }) => void, delay = 100) {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight })

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null

    const handleResize = () => {
      if (timeoutId) return

      timeoutId = setTimeout(() => {
        const newSize = { width: window.innerWidth, height: window.innerHeight }
        setSize(newSize)
        callback(newSize)
        timeoutId = null
      }, delay)
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [callback, delay])

  return size
}

/**
 * Hook para scroll suave
 */
export function useSmoothScroll() {
  const scrollTo = useCallback((target: string | HTMLElement, offset = 0) => {
    const element = typeof target === 'string' ? document.querySelector(target) : target
    if (!element) return

    const top = element.getBoundingClientRect().top + window.scrollY - offset
    window.scrollTo({ top, behavior: 'smooth' })
  }, [])

  return { scrollTo }
}

/**
 * Hook para lazy loading de imagens
 */
export function useLazyLoadImage(src: string, placeholder?: string) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const [currentSrc, setCurrentSrc] = useState(placeholder || '')

  useEffect(() => {
    if (!src) {
      setCurrentSrc(placeholder || '')
      return
    }

    const img = new Image()
    img.src = src

    img.onload = () => {
      setCurrentSrc(src)
      setLoaded(true)
      setError(false)
    }

    img.onerror = () => {
      setError(true)
      setLoaded(false)
    }

    return () => {
      img.onload = null
      img.onerror = null
    }
  }, [src, placeholder])

  return { loaded, error, currentSrc }
}

/**
 * Hook para Intersection Observer (lazy loading, animações)
 */
export function useIntersectionObserver(
  options: IntersectionObserverInit = {}
): [RefObject<HTMLElement | null>, boolean] {
  const ref = useRef<HTMLElement | null>(null)
  const [isIntersecting, setIsIntersecting] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting)
      },
      { threshold: 0.1, ...options }
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [options.threshold, options.root, options.rootMargin])

  return [ref, isIntersecting]
}

/**
 * Utility para classNames condicionais
 */
export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ')
}

/**
 * Format bytes para display
 */
export function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

/**
 * Debounce utility
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null

  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func(...args), wait)
  }
}

/**
 * Throttle utility
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => {
        inThrottle = false
      }, limit)
    }
  }
}

/**
 * Hook para prefers-reduced-motion
 */
export function usePrefersReducedMotion() {
  const [prefersReduced, setPrefersReduced] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReduced(mediaQuery.matches)

    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  return prefersReduced
}

/**
 * Hook para visibility (aba ativa)
 */
export function usePageVisibility() {
  const [isVisible, setIsVisible] = useState(!document.hidden)

  useEffect(() => {
    const handleChange = () => setIsVisible(!document.hidden)
    document.addEventListener('visibilitychange', handleChange)
    return () => document.removeEventListener('visibilitychange', handleChange)
  }, [])

  return isVisible
}

/**
 * Componente de skeleton loading responsivo
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`skeleton bg-gray-200 dark:bg-gray-700 animate-pulse ${className}`}
      aria-hidden="true"
    />
  )
}

/**
 * Placeholder de card para loading
 */
export function CardSkeleton() {
  return (
    <div className="card-responsive bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-full" />
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="h-8 w-20 rounded-full" />
      </div>
    </div>
  )
}

/**
 * Lista de skeletons para grids
 */
export function CardSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-mobile-1">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  )
}
