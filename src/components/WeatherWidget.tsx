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
import { useTheme } from '../contexts/ThemeContext'

// WMO Weather interpretation codes
function getWeatherDetails(code: number) {
  if (code === 0) return { label: 'Céu Limpo', icon: <img src="/icons/sun.png" alt="Sol" className="w-16 h-16 object-contain" /> }
  if (code === 1 || code === 2) return { label: 'Parcialmente Nublado', icon: <Cloud className="text-slate-500 dark:text-slate-300" size={32} /> }
  if (code === 3) return { label: 'Nublado', icon: <Cloud className="text-slate-600 dark:text-slate-400" size={32} /> }
  if (code === 45 || code === 48) return { label: 'Neblina', icon: <CloudFog className="text-slate-500 dark:text-slate-400" size={32} /> }
  if (code >= 51 && code <= 55) return { label: 'Garoa', icon: <CloudDrizzle className="text-blue-500 dark:text-blue-300" size={32} /> }
  if (code >= 61 && code <= 65) return { label: 'Chuva', icon: <CloudRain className="text-blue-600 dark:text-blue-400" size={32} /> }
  if (code >= 71 && code <= 77) return { label: 'Neve', icon: <CloudSnow className="text-slate-700 dark:text-white" size={32} /> }
  if (code >= 80 && code <= 82) return { label: 'Pancadas de Chuva', icon: <CloudRain className="text-blue-600 dark:text-blue-400" size={32} /> }
  if (code >= 85 && code <= 86) return { label: 'Tempestade de Neve', icon: <CloudSnow className="text-slate-700 dark:text-white" size={32} /> }
  if (code >= 95 && code <= 99) return { label: 'Tempestade', icon: <CloudLightning className="text-yellow-500" size={32} /> }
  
  return { label: 'Desconhecido', icon: <Cloud className="text-slate-500 dark:text-slate-400" size={32} /> }
}

export function WeatherWidget() {
  const { isDark } = useTheme()
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
      <div className="dashboard-card card-weather flex flex-col justify-center items-center">
        <Loader2 className={`animate-spin ${isDark ? 'text-white/50' : 'text-gray-400'}`} size={24} />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="dashboard-card card-weather flex flex-col justify-center items-center">
        <p className={`text-sm ${isDark ? 'text-white/50' : 'text-gray-500'}`}>Clima indisponível</p>
      </div>
    )
  }

  const details = getWeatherDetails(data.code)

  return (
    <div className="dashboard-card card-weather">
      <div className="card-header" style={{ justifyContent: 'flex-end', marginBottom: '10px' }}>
        <button className="card-menu">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
        </button>
      </div>

      <div className="weather-main">
        <div className="weather-icon">
          {details.icon}
        </div>
        <div>
          <div className="weather-temp">{data.temp}°C</div>
          <div className="weather-status">{details.label}</div>
        </div>
      </div>

      <div className="weather-divider"></div>

      <div className="weather-info">
        <div className="weather-row">
          <MapPin size={16} />
          {data.location}
        </div>
        <div className="weather-row">
          <Calendar size={16} />
          {currentDate} {currentTime}
        </div>
      </div>
    </div>
  )
}


