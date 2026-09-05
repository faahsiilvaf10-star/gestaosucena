import React, { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import { X, Check, ZoomIn, ZoomOut } from 'lucide-react'
import { Point, Area } from 'react-easy-crop/types'

interface AvatarCropperModalProps {
  isOpen: boolean
  onClose: () => void
  imageSrc: string
  onCropComplete: (croppedAreaPixels: Area) => void
}

export function AvatarCropperModal({ isOpen, onClose, imageSrc, onCropComplete }: AvatarCropperModalProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)

  const handleCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const handleConfirm = () => {
    if (croppedAreaPixels) {
      onCropComplete(croppedAreaPixels)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#121214] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="text-white font-bold">Ajustar Foto de Perfil</h3>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="relative w-full h-[300px] bg-black/50">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={handleCropComplete}
          />
        </div>
        
        <div className="p-4 flex flex-col gap-4">
          <div className="flex items-center gap-3 text-white/70">
            <ZoomOut size={18} />
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              aria-labelledby="Zoom"
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-yellow-400"
            />
            <ZoomIn size={18} />
          </div>
          
          <div className="flex justify-end gap-3 mt-2">
            <button 
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              Cancelar
            </button>
            <button 
              onClick={handleConfirm}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-yellow-500 hover:bg-yellow-400 text-black transition-colors"
            >
              <Check size={16} />
              Salvar Foto
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
