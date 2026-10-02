import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En producción se despliega en GitHub Pages bajo /titan-habits/.
// En desarrollo local Vite sirve desde la raíz.
// 'vite preview' sirve el build, así que también usa la base de producción.
export default defineConfig(({ command, isPreview }) => ({
  plugins: [react()],
  base: command === 'build' || isPreview ? '/titan-habits/' : '/',
}));
