import * as React from "react"
import { Label, Pie, PieChart, Cell } from "recharts"

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

export interface Chart02Props {
  value: number
  total: number
  color: string
  trackColor: string
  label: string
}

export default function Chart02({ value, total, color, trackColor, label }: Chart02Props) {
  const data = [
    { name: label, value: value, fill: color },
    { name: "Restante", value: Math.max(total - value, 0), fill: trackColor },
  ]

  const chartConfig = {
    [label]: {
      label: label,
      color: color,
    },
    Restante: {
      label: "Restante",
      color: trackColor,
    },
  } satisfies ChartConfig

  return (
    <ChartContainer
      config={chartConfig}
      className="mx-auto aspect-square w-[120px] h-[120px]"
    >
      <PieChart>
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent hideLabel />}
        />
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={45}
          outerRadius={60}
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
            <Cell key={`cell-${index}`} fill={entry.fill} />
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
                      className="fill-foreground text-[32px] font-bold"
                    >
                      {value}
                    </tspan>
                    <tspan
                      x={viewBox.cx}
                      y={(viewBox.cy || 0) + 16}
                      className="fill-muted-foreground text-[12px]"
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
