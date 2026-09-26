import { useState, useEffect } from 'react'
import {
  Sun,
  Cloud,
  CloudRain,
  CloudLightning,
  CloudSnow,
  CloudFog,
  CloudDrizzle,
  Loader2
} from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'

// WMO Weather interpretation codes
export function getWeatherDetails(code: number) {
  if (code === 0) return { label: 'Céu Limpo', icon: <img src="/icons/sun.png" alt="Sol" className="w-5 h-5 object-contain" /> }
  if (code === 1 || code === 2) return { label: 'Parcialmente Nublado', icon: <Cloud className="text-slate-500 dark:text-slate-300" size={20} /> }
  if (code === 3) return { label: 'Nublado', icon: <Cloud className="text-slate-600 dark:text-slate-400" size={20} /> }
  if (code === 45 || code === 48) return { label: 'Neblina', icon: <CloudFog className="text-slate-500 dark:text-slate-400" size={20} /> }
  if (code >= 51 && code <= 55) return { label: 'Garoa', icon: <CloudDrizzle className="text-blue-500 dark:text-blue-300" size={20} /> }
  if (code >= 61 && code <= 65) return { label: 'Chuva', icon: <CloudRain className="text-blue-600 dark:text-blue-400" size={20} /> }
  if (code >= 71 && code <= 77) return { label: 'Neve', icon: <CloudSnow className="text-slate-700 dark:text-white" size={20} /> }
  if (code >= 80 && code <= 82) return { label: 'Pancadas', icon: <CloudRain className="text-blue-600 dark:text-blue-400" size={20} /> }
  if (code >= 85 && code <= 86) return { label: 'Neve', icon: <CloudSnow className="text-slate-700 dark:text-white" size={20} /> }
  if (code >= 95 && code <= 99) return { label: 'Tempestade', icon: <CloudLightning className="text-yellow-500" size={20} /> }
  
  return { label: 'Desconhecido', icon: <Cloud className="text-slate-500 dark:text-slate-400" size={20} /> }
}

export function MiniWeatherWidget() {
  const { isDark } = useTheme()
  const [data, setData] = useState<{ temp: number; code: number; location: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function fetchWeather(lat: number, lon: number) {
      try {
        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`)
        
        if (!weatherRes.ok) throw new Error('API Error')

        const weatherData = await weatherRes.json()
        
        setData({
          temp: Math.round(weatherData.current.temperature_2m),
          code: weatherData.current.weather_code,
          location: ''
        })
      } catch (err) {
        console.error(err)
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    if ("geolocation" in navigator) {
      let isResolved = false;

      const fallbackTimer = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          const env = localStorage.getItem('sucena_environment')
          if (env === 'paragominas') fetchWeather(-2.9998, -47.3537)
          else fetchWeather(-1.5061, -48.6258)
        }
      }, 3000);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (!isResolved) {
            isResolved = true;
            clearTimeout(fallbackTimer);
            fetchWeather(position.coords.latitude, position.coords.longitude)
          }
        },
        (err) => {
          if (!isResolved) {
            isResolved = true;
            clearTimeout(fallbackTimer);
            const env = localStorage.getItem('sucena_environment')
            if (env === 'paragominas') fetchWeather(-2.9998, -47.3537)
            else fetchWeather(-1.5061, -48.6258)
          }
        },
        { timeout: 5000 }
      )
    } else {
      const env = localStorage.getItem('sucena_environment')
      if (env === 'paragominas') fetchWeather(-2.9998, -47.3537)
      else fetchWeather(-1.5061, -48.6258)
    }
  }, [])

  if (loading) {
    return (
      <div className={`flex items-center justify-center min-w-[44px] h-[44px] px-2 rounded-xl transition-colors ${isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'}`}>
        <Loader2 className={`animate-spin ${isDark ? 'text-white/50' : 'text-gray-400'}`} size={16} />
      </div>
    )
  }

  if (error || !data) {
    return null;
  }

  const details = getWeatherDetails(data.code)

  return (
    <div 
      className={`flex items-center gap-2 px-3 h-[44px] rounded-xl transition-colors cursor-default ${isDark ? 'hover:bg-white/5 text-white/90' : 'hover:bg-black/5 text-gray-800'}`}
      title={details.label}
    >
      <div className="flex items-center justify-center">
        {details.icon}
      </div>
      <span className="text-xs font-bold whitespace-nowrap">{data.temp}°C</span>
    </div>
  )
}
