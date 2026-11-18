import React from 'react'
import { DashboardGeradorLokCenter } from './DashboardGeradorLokCenter'

interface DashboardGeradorHorimetroBannerProps {
  currentEnv?: string
}

export function DashboardGeradorHorimetroBanner({
  currentEnv
}: DashboardGeradorHorimetroBannerProps) {
  return <DashboardGeradorLokCenter currentEnv={currentEnv} />
}
