import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En producción se despliega en GitHub Pages bajo /titan-habits/.
// En desarrollo local Vite sirve desde la raíz.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/titan-habits/' : '/',
}));
