import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiPort = env.PORT || '3011'
  const webPort = Number(env.VITE_PORT || '5199')
  const devHttps = env.VITE_DEV_HTTPS === 'true' || env.VITE_DEV_HTTPS === '1'

  return {
    plugins: [react(), tailwindcss(), ...(devHttps ? [basicSsl()] : [])],
    server: {
      host: true,
      port: webPort,
      strictPort: true,
      ...(devHttps ? { https: {} } : {}),
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${apiPort}`,
          changeOrigin: true,
        },
      },
    },
    preview: {
      host: true,
      port: webPort,
      strictPort: true,
    },
  }
})
