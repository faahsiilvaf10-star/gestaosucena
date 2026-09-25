import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  base: './', // Necessário para o Electron carregar os arquivos locais
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
