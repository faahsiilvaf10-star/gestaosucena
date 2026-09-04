import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export type ColorOption = 'red' | 'blue' | 'yellow' | 'green'

const defaultColors: ColorOption[] = [
  'red', 'blue', 'yellow', 'green',
  'red', 'blue', 'yellow', 'green',
  'red', 'blue', 'yellow', 'green'
]

export function useMonthlyColors() {
  const colors = defaultColors

  // Mock function to avoid breaking components that expect it
  const updateColor = async (monthIndex: number, color: ColorOption) => {
    console.log("Colors are fixed and cannot be changed.")
  }

  return { colors, updateColor }

  const currentMonthIndex = new Date().getMonth()
  const currentColor = colors[currentMonthIndex]

  return { colors, updateColor, currentColor }
}
