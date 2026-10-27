import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { readPortalConfiguration } from './src/services/configuration.ts'
// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // Vite embeds these values into the JavaScript bundle. Reject a wrong project
  // before it can replace a working production deployment.
  if(command==='build')readPortalConfiguration({...loadEnv(mode,process.cwd(),''),DEV:false})
  return {
  plugins: [react()],
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  // For classrooms: build once, then `npm run preview` serves compressed static
  // files to every device on the LAN. Never serve 80 users from `npm run dev`.
  preview: {
    host: true,
    port: 4173,
  },
  build: {
    // Split long-lived vendor code so deploys only re-download what changed.
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined
          if (/[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react'
          if (/[\\/]motion[\\/]/.test(id)) return 'motion'
          if (id.includes('@supabase')) return 'supabase'
          return undefined
        },
      },
    },
  },
  }
})
