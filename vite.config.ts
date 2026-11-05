import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// Relative base so the build works on GitHub Pages under /<repo>/ and locally.
export default defineConfig({
  base: './',
  plugins: [preact()],
  build: { target: 'es2022' },
  test: { environment: 'node' },
} as any);
