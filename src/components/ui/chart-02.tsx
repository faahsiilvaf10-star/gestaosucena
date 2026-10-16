import * as React from "react"
import { Label, Pie, PieChart, Cell } from "recharts"

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { useTheme } from "../../contexts/ThemeContext"

export interface Chart02Props {
  value: number
  total: number
  color: string
  trackColor: string
  label: string
}

export default function Chart02({ value, total, color, trackColor, label }: Chart02Props) {
  const { isDark } = useTheme()
  const rawId = React.useId()
  const filterId = `neon-glow-${rawId.replace(/[^a-zA-Z0-9-_]/g, '')}`

  const activeColor = isDark ? "#ffffff" : color
  const activeTrackColor = isDark ? "rgba(255, 255, 255, 0.12)" : trackColor

  const data = [
    { name: label, value: value, fill: activeColor },
    { name: "Restante", value: Math.max(total - value, 0), fill: activeTrackColor },
  ]

  const chartConfig = {
    [label]: {
      label: label,
      color: activeColor,
    },
    Restante: {
      label: "Restante",
      color: activeTrackColor,
    },
  } satisfies ChartConfig

  return (
    <ChartContainer
      config={chartConfig}
      className="mx-auto aspect-square w-[130px] h-[130px] overflow-visible [&_.recharts-surface]:overflow-visible"
      style={{ overflow: 'visible' }}
    >
      <PieChart style={{ overflow: 'visible' }}>
        <defs>
          <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#ffffff" floodOpacity="0.95" />
            <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#ffffff" floodOpacity="0.75" />
            <feDropShadow dx="0" dy="0" stdDeviation="14" floodColor="#ffffff" floodOpacity="0.45" />
          </filter>
        </defs>
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent hideLabel />}
        />
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={40}
          outerRadius={55}
          strokeWidth={0}
          paddingAngle={0}
          startAngle={90}
          endAngle={-270}
          isAnimationActive={false}
        >
          {data.map((entry, index) => {
            const isPrimary = index === 0 && entry.value > 0
            return (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.fill} 
                filter={isPrimary && isDark ? `url(#${filterId})` : undefined}
                style={{
                  outline: 'none',
                  filter: isPrimary && isDark 
                    ? 'drop-shadow(0 0 4px rgba(255, 255, 255, 0.95)) drop-shadow(0 0 10px rgba(255, 255, 255, 0.75)) drop-shadow(0 0 18px rgba(255, 255, 255, 0.45))' 
                    : undefined
                }}
              />
            )
          })}
          <Label
            content={({ viewBox }) => {
              if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                return (
                  <text
                    x={viewBox.cx}
                    y={viewBox.cy}
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    <tspan
                      x={viewBox.cx}
                      y={(viewBox.cy || 0) - 4}
                      className="fill-foreground dark:fill-white text-[32px] font-bold"
                      style={isDark ? {
                        filter: "drop-shadow(0px 0px 6px rgba(255, 255, 255, 0.95)) drop-shadow(0px 0px 14px rgba(255, 255, 255, 0.6))"
                      } : undefined}
                    >
                      {value}
                    </tspan>
                    <tspan
                      x={viewBox.cx}
                      y={(viewBox.cy || 0) + 16}
                      className="fill-muted-foreground dark:fill-white text-[12px] font-medium"
                      style={isDark ? {
                        filter: "drop-shadow(0px 0px 4px rgba(255, 255, 255, 0.6))"
                      } : undefined}
                    >
                      de {total}
                    </tspan>
                  </text>
                )
              }
            }}
          />
        </Pie>
      </PieChart>
    </ChartContainer>
  )
}
