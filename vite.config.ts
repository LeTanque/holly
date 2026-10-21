import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiPort = env.PORT || '3011'
  const webPort = Number(env.VITE_PORT || '5199')

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: webPort,
      strictPort: true,
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${apiPort}`,
          changeOrigin: true,
          timeout: 300_000,
          proxyTimeout: 300_000,
        },
      },
    },
    preview: {
      port: webPort,
      strictPort: true,
    },
  }
})
