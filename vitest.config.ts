import { defineConfig } from 'vitest/config'
import path from 'path'

// Separate from vite.config.ts so unit tests don't load the PWA plugin
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
