import { useState, useEffect } from 'react'
import {
  Sun,
  Cloud,
  CloudRain,
  CloudLightning,
  CloudSnow,
  CloudFog,
  CloudDrizzle,
  MapPin,
  Calendar,
  Loader2
} from 'lucide-react'

// WMO Weather interpretation codes
function getWeatherDetails(code: number) {
  if (code === 0) return { label: 'Céu Limpo', icon: <Sun className="text-yellow-400" size={32} /> }
  if (code === 1 || code === 2) return { label: 'Parcialmente Nublado', icon: <Cloud className="text-gray-300" size={32} /> }
  if (code === 3) return { label: 'Nublado', icon: <Cloud className="text-gray-400" size={32} /> }
  if (code === 45 || code === 48) return { label: 'Neblina', icon: <CloudFog className="text-gray-400" size={32} /> }
  if (code >= 51 && code <= 55) return { label: 'Garoa', icon: <CloudDrizzle className="text-blue-300" size={32} /> }
  if (code >= 61 && code <= 65) return { label: 'Chuva', icon: <CloudRain className="text-blue-400" size={32} /> }
  if (code >= 71 && code <= 77) return { label: 'Neve', icon: <CloudSnow className="text-white" size={32} /> }
  if (code >= 80 && code <= 82) return { label: 'Pancadas de Chuva', icon: <CloudRain className="text-blue-500" size={32} /> }
  if (code >= 85 && code <= 86) return { label: 'Tempestade de Neve', icon: <CloudSnow className="text-white" size={32} /> }
  if (code >= 95 && code <= 99) return { label: 'Tempestade', icon: <CloudLightning className="text-yellow-500" size={32} /> }
  
  return { label: 'Desconhecido', icon: <Cloud className="text-gray-400" size={32} /> }
}

export function WeatherWidget() {
  const [data, setData] = useState<{ temp: number; code: number; location: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const currentDate = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  })
  
  const currentTime = new Date().toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  })

  useEffect(() => {
    async function fetchWeather(lat: number, lon: number) {
      try {
        const [weatherRes, geoRes] = await Promise.all([
          fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`),
          fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=pt`)
        ])
        
        if (!weatherRes.ok || !geoRes.ok) throw new Error('API Error')

        const weatherData = await weatherRes.json()
        const geoData = await geoRes.json()
        
        let location = geoData.locality || geoData.city || 'Desconhecido'
        if (geoData.principalSubdivisionCode) {
          const stateCode = geoData.principalSubdivisionCode.split('-')[1] || geoData.principalSubdivisionCode
          location = `${location}, ${stateCode}`
        }

        setData({
          temp: Math.round(weatherData.current.temperature_2m),
          code: weatherData.current.weather_code,
          location
        })
      } catch (err) {
        console.error(err)
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          fetchWeather(position.coords.latitude, position.coords.longitude)
        },
        (err) => {
          const env = localStorage.getItem('sucena_environment')
          if (env === 'paragominas') {
            console.warn("Geolocation blocked, using default (Paragominas).")
            fetchWeather(-2.9998, -47.3537)
          } else {
            console.warn("Geolocation blocked, using default (Barcarena).")
            fetchWeather(-1.5061, -48.6258)
          }
        },
        { timeout: 5000 }
      )
    } else {
      const env = localStorage.getItem('sucena_environment')
      if (env === 'paragominas') {
        fetchWeather(-2.9998, -47.3537)
      } else {
        fetchWeather(-1.5061, -48.6258)
      }
    }
  }, [])

  if (loading) {
    return (
      <div className="bg-[#111113]/80 border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center h-[160px]">
        <Loader2 className="animate-spin text-white/50" size={24} />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="bg-[#111113]/80 border border-white/5 rounded-2xl p-4 flex flex-col justify-center h-[160px]">
        <p className="text-white/50 text-sm">Clima indisponível</p>
      </div>
    )
  }

  const details = getWeatherDetails(data.code)

  return (
    <div className="bg-gradient-to-br from-[#1c2c36] to-[#121a22] border border-white/5 rounded-2xl p-4 flex flex-col h-[160px] shadow-lg relative overflow-hidden">
      {/* Decorative blurred circle */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>

      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-3">
          {details.icon}
          <div>
            <h3 className="text-4xl font-light text-white tracking-tight">{data.temp}°C</h3>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-1 mb-auto">
        <Cloud className="text-white/50" size={14} />
        <span className="text-white/80 text-sm font-medium">{details.label}</span>
      </div>

      <div className="border-t border-white/10 my-2 pt-2 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <MapPin size={12} className="text-white/50" />
          <span className="text-xs text-white/60">{data.location}</span>
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={12} className="text-white/50" />
          <span className="text-xs text-white/60 capitalize">{currentDate} {currentTime}</span>
        </div>
      </div>
    </div>
  )
}
