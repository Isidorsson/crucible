import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  worker: {
    format: 'es'
  },
  server: {
    headers: {
      // SharedArrayBuffer + cross-origin isolation for future multi-threaded WASM
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  }
});
