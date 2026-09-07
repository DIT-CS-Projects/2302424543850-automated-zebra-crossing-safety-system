import { defineConfig } from 'vite'

export default defineConfig({
    server: {
        proxy: {
            '/api': {
                target: 'http://localhost:5000',   // Flask server address
                changeOrigin: true,
            },
            '/health': {
                target: 'http://localhost:5000',
                changeOrigin: true,
            }
        }
    }
})