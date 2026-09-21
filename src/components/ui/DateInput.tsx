import { useState, useEffect, useRef } from 'react'
import { Calendar as CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { Calendar } from './calendar'

interface DateInputProps {
  value: string // expects yyyy-mm-dd
  onChange: (value: string) => void // returns yyyy-mm-dd
  className?: string
  placeholder?: string
  disabled?: boolean
}

/**
 * DateInput - Input de data no formato brasileiro (dd/mm/aaaa)
 * Internamente armazena e retorna no formato yyyy-mm-dd (ISO).
 */
export function DateInput({ value, onChange, className = '', placeholder = 'dd/mm/aaaa', disabled = false }: DateInputProps) {
  const [display, setDisplay] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Converte yyyy-mm-dd -> dd/mm/aaaa para exibição
  useEffect(() => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split('-')
      setDisplay(`${d}/${m}/${y}`)
    } else if (!value) {
      setDisplay('')
    }
  }, [value])

  // Aplica máscara enquanto digita
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, '') // remove tudo que não é dígito
    
    if (raw.length > 8) raw = raw.slice(0, 8)
    
    let formatted = ''
    if (raw.length > 0) formatted = raw.slice(0, 2)
    if (raw.length > 2) formatted += '/' + raw.slice(2, 4)
    if (raw.length > 4) formatted += '/' + raw.slice(4, 8)
    
    setDisplay(formatted)
    
    // Quando temos a data completa, converte para yyyy-mm-dd
    if (raw.length === 8) {
      const day = raw.slice(0, 2)
      const month = raw.slice(2, 4)
      const year = raw.slice(4, 8)
      const isoDate = `${year}-${month}-${day}`
      
      // Validação básica
      const dateObj = new Date(`${year}-${month}-${day}T12:00:00`)
      if (!isNaN(dateObj.getTime())) {
        onChange(isoDate)
      }
    } else {
      // Data incompleta - limpa o valor
      if (value && raw.length === 0) {
        onChange('')
      }
    }
  }

  const selectedDate = value ? new Date(`${value}T12:00:00`) : undefined

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
        maxLength={10}
      />
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-80 transition-opacity"
            tabIndex={-1}
            disabled={disabled}
            aria-label="Abrir calendário"
          >
            <CalendarIcon size={16} />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => date && onChange(format(date, 'yyyy-MM-dd'))}
            locale={ptBR}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
