import { useEffect, useRef, useState } from 'react'

const FRAME_COUNT = 50
// Define target FPS for smooth playback. A lower value makes it slower, higher makes it faster.
const PLAYBACK_FPS = 12

export function CanvasScroll() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [images, setImages] = useState<HTMLImageElement[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  
  const currentFrame = useRef(0)
  const lastTime = useRef(0)
  const requestRef = useRef<number>()
  
  // Cache layout calculations to avoid computing every frame
  const layoutCache = useRef({
    width: 0,
    height: 0,
    drawWidth: 0,
    drawHeight: 0,
    offsetX: 0,
    offsetY: 0
  })

  // Pre-load images
  useEffect(() => {
    const loadedImages: HTMLImageElement[] = []
    let loadedCount = 0

    for (let i = 1; i <= FRAME_COUNT; i++) {
      const img = new Image()
      const paddedIndex = i.toString().padStart(3, '0')
      img.src = `/Imagens/ezgif-frame-${paddedIndex}.png`
      
      img.onload = () => {
        loadedCount++
        if (loadedCount === FRAME_COUNT) {
          setImages([...loadedImages])
          setIsLoaded(true)
        }
      }
      img.onerror = () => {
        console.error(`Failed to load frame ${paddedIndex}`)
        loadedCount++
        if (loadedCount === FRAME_COUNT) {
          setImages([...loadedImages])
          setIsLoaded(true)
        }
      }
      loadedImages.push(img)
    }
  }, [])

  // Animation Loop & Canvas Rendering
  useEffect(() => {
    if (!isLoaded || images.length < FRAME_COUNT || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d', { alpha: false }) // Optimize for solid background
    if (!ctx) return

    // Offscreen canvas to cache the gradient overlay, preventing expensive CPU recreation every frame
    const gradientCacheCanvas = document.createElement('canvas')
    const gradCtx = gradientCacheCanvas.getContext('2d')

    const updateLayout = () => {
      const dpr = window.devicePixelRatio || 1
      const displayWidth = window.innerWidth
      const displayHeight = window.innerHeight
      
      canvas.width = displayWidth * dpr
      canvas.height = displayHeight * dpr

      const img = images[0]
      if (!img || !img.complete) return

      const scaleFactor = 0.8
      const imgRatio = img.width / img.height
      const canvasRatio = canvas.width / canvas.height
      
      let drawWidth, drawHeight, offsetX, offsetY
      
      if (canvasRatio > imgRatio) {
        drawHeight = canvas.height * scaleFactor
        drawWidth = drawHeight * imgRatio
        offsetX = (canvas.width - drawWidth) / 2
        offsetY = (canvas.height - drawHeight) / 2
      } else {
        drawWidth = canvas.width * scaleFactor
        drawHeight = drawWidth / imgRatio
        offsetX = (canvas.width - drawWidth) / 2
        offsetY = (canvas.height - drawHeight) / 2
      }

      layoutCache.current = {
        width: canvas.width,
        height: canvas.height,
        drawWidth,
        drawHeight,
        offsetX,
        offsetY
      }

      // Pre-render the gradient to the cache canvas
      if (gradCtx) {
        gradientCacheCanvas.width = drawWidth
        gradientCacheCanvas.height = drawHeight
        
        const fadeSize = Math.min(drawWidth, drawHeight) * 0.15
        gradCtx.clearRect(0, 0, drawWidth, drawHeight)
        
        // Top
        const topGrad = gradCtx.createLinearGradient(0, 0, 0, fadeSize)
        topGrad.addColorStop(0, '#050505')
        topGrad.addColorStop(1, 'rgba(5, 5, 5, 0)')
        gradCtx.fillStyle = topGrad
        gradCtx.fillRect(0, 0, drawWidth, fadeSize)
        
        // Bottom
        const bottomGrad = gradCtx.createLinearGradient(0, drawHeight, 0, drawHeight - fadeSize)
        bottomGrad.addColorStop(0, '#050505')
        bottomGrad.addColorStop(1, 'rgba(5, 5, 5, 0)')
        gradCtx.fillStyle = bottomGrad
        gradCtx.fillRect(0, drawHeight - fadeSize, drawWidth, fadeSize)
        
        // Left
        const leftGrad = gradCtx.createLinearGradient(0, 0, fadeSize, 0)
        leftGrad.addColorStop(0, '#050505')
        leftGrad.addColorStop(1, 'rgba(5, 5, 5, 0)')
        gradCtx.fillStyle = leftGrad
        gradCtx.fillRect(0, 0, fadeSize, drawHeight)
        
        // Right
        const rightGrad = gradCtx.createLinearGradient(drawWidth, 0, drawWidth - fadeSize, 0)
        rightGrad.addColorStop(0, '#050505')
        rightGrad.addColorStop(1, 'rgba(5, 5, 5, 0)')
        gradCtx.fillStyle = rightGrad
        gradCtx.fillRect(drawWidth - fadeSize, 0, fadeSize, drawHeight)
      }
    }

    // Initial setup and event listener
    updateLayout()
    window.addEventListener('resize', updateLayout)

    lastTime.current = performance.now()

    const render = (time: number) => {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      
      // Calculate delta time
      const deltaTime = time - lastTime.current
      lastTime.current = time

      // Increment frame smoothly based on actual time elapsed (e.g. 12 fps)
      if (!prefersReducedMotion) {
        currentFrame.current += (deltaTime / 1000) * PLAYBACK_FPS
      } else {
        // Just jump to end if reduced motion is requested
        currentFrame.current = FRAME_COUNT - 1
      }

      // Cap at final frame
      if (currentFrame.current > FRAME_COUNT - 1) {
        currentFrame.current = FRAME_COUNT - 1
      }

      const frameIndex = Math.floor(currentFrame.current)
      const img = images[frameIndex]
      
      if (img && img.complete && img.naturalWidth !== 0) {
        const { width, height, drawWidth, drawHeight, offsetX, offsetY } = layoutCache.current

        // Background
        ctx.fillStyle = '#050505'
        ctx.fillRect(0, 0, width, height)
        
        // Image
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight)
        
        // Overlay pre-rendered gradient mask on top (Hardware Accelerated, highly optimized)
        if (gradientCacheCanvas.width > 0) {
          ctx.drawImage(gradientCacheCanvas, offsetX, offsetY, drawWidth, drawHeight)
        }
      }

      // Stop loop if we reached the end
      if (currentFrame.current < FRAME_COUNT - 1) {
        requestRef.current = requestAnimationFrame(render)
      }
    }

    requestRef.current = requestAnimationFrame(render)

    return () => {
      window.removeEventListener('resize', updateLayout)
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current)
      }
    }
  }, [isLoaded, images])

  return (
    <div ref={containerRef} className="h-screen w-full bg-[#050505] relative overflow-hidden">
        
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center text-white/50 z-20 font-display italic tracking-widest text-xl">
            Preparando experiência...
          </div>
        )}

        <canvas 
          ref={canvasRef} 
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000"
          style={{ 
            width: '100vw', 
            height: '100vh',
            opacity: isLoaded ? 1 : 0 
          }}
        />
        
        {/* Soft luxury gradient overlay to blend extreme outer edges if needed */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent opacity-80 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#050505] via-transparent to-transparent opacity-80 pointer-events-none" />
        
    </div>
  )
}
