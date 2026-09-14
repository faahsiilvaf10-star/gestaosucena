const fs = require('fs')

const file = 'd:/gestaosucena-main/gestaosucena/src/components/app-motorista/ParteDiariaReport.tsx'
let content = fs.readFileSync(file, 'utf8')

const colorMap = {
  'bg-white': 'bg-[#ffffff]',
  'text-black': 'text-[#000000]',
  'border-black': 'border-[#000000]',
  'bg-gray-100/50': 'bg-[#f3f4f6]',
  'bg-gray-200/50': 'bg-[#e5e7eb]',
  'bg-gray-100': 'bg-[#f3f4f6]',
  'bg-gray-200': 'bg-[#e5e7eb]',
  'text-gray-700': 'text-[#374151]',
  'bg-gray-50/30': 'bg-[#f9fafb]',
  'bg-gray-50': 'bg-[#f9fafb]'
}

for (const [key, value] of Object.entries(colorMap)) {
  const regex = new RegExp(`\\b${key}\\b`, 'g')
  content = content.replace(regex, value)
}

fs.writeFileSync(file, content)
console.log('Replaced colors')
