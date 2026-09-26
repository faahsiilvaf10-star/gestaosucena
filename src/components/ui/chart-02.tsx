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
  const activeColor = isDark ? "#ffffff" : color;
  const activeTrackColor = isDark ? "rgba(255, 255, 255, 0.1)" : trackColor;

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
      className="mx-auto aspect-square w-[130px] h-[130px] overflow-visible"
      style={{ overflow: 'visible' }}
    >
      <PieChart style={{ overflow: 'visible' }}>
        <defs>
          <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#ffffff" floodOpacity="0.8"/>
            <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#ffffff" floodOpacity="0.4"/>
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
          isAnimationActive={true}
          animationBegin={200}
          animationDuration={1500}
          animationEasing="ease-out"
        >
          {data.map((entry, index) => (
            <Cell 
              key={`cell-${index}`} 
              fill={entry.fill} 
              filter={index === 0 && isDark ? "url(#neon-glow)" : undefined}
              style={{ outline: 'none' }}
            />
          ))}
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
                      style={isDark ? { filter: "drop-shadow(0px 0px 8px rgba(255, 255, 255, 0.8))" } : {}}
                    >
                      {value}
                    </tspan>
                    <tspan
                      x={viewBox.cx}
                      y={(viewBox.cy || 0) + 16}
                      className="fill-muted-foreground dark:fill-white text-[12px]"
                      style={isDark ? { filter: "drop-shadow(0px 0px 4px rgba(255, 255, 255, 0.6))" } : {}}
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
