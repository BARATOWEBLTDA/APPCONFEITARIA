import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { montarLanding } from './landing/montar'

// Etiqueta de versão: muda a cada build (deploy). O app compara com /version.json
// pra saber se tem versão nova (Configurações → Ações rápidas → Atualizar app).
const BUILD_ID = new Date().toISOString()

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'doonly-version',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ id: BUILD_ID }) })
      },
    },
    {
      // (6.145) a página de vendas fica em doonly.com.br/ e o app em dist/app.html (landing/montar.ts)
      name: 'doonly-landing',
      apply: 'build',
      closeBundle() { montarLanding(__dirname, path.resolve(__dirname, 'dist'), BUILD_ID.replace(/\D/g, '').slice(0, 12)) },
    },
  ],
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
  },
  // (01/11 · 5.99) junta os pedaços muito pequenos (cada ícone virava um arquivo de 1 KB: mais de 100 pedidos na abertura)
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // ícones usados por várias telas: agrupados por quem usa (cada tela baixa só os que precisa)
            { name: 'icones', test: /@phosphor-icons/, entriesAware: true, entriesAwareMergeThreshold: 24_000 },
          ],
        },
      },
    },
  },
})