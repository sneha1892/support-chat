import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    server: {
      proxy: env.VITE_LAMBDA_URL
        ? {
            '/api/chat': {
              target: env.VITE_LAMBDA_URL,
              changeOrigin: true,
              secure: true,
              rewrite: () => '/',
              headers: env.VITE_ORCA_API_KEY
                ? {
                    'x-orca-api-key': env.VITE_ORCA_API_KEY
                  }
                : undefined
            }
          }
        : undefined
    }
  }
})
