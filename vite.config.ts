import { defineConfig } from 'vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// `BASE_PATH` is injected by the GitHub Pages workflow (e.g. "/home-renovation/").
// Locally it defaults to "/" so `vite dev` and `vite preview` just work.
const base = process.env.BASE_PATH ?? '/'

const config = defineConfig({
  base,
  resolve: { tsconfigPaths: true },
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    viteReact(),
    tailwindcss(),
  ],
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})

export default config
