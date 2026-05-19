import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import svelteConfig from './svelte.config.js';

/** @type {import('eslint').Linter.Config[]} */
export default [
  js.configs.recommended,
  ...svelte.configs['flat/recommended'],
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        // Browser + Worker shared globals
        window: 'readonly',
        document: 'readonly',
        self: 'readonly',
        WorkerGlobalScope: 'readonly',
        crucible: 'readonly',
        Go: 'readonly',
        importScripts: 'readonly',
        performance: 'readonly',
        fetch: 'readonly',
        WebAssembly: 'readonly',
        MessageEvent: 'readonly',
        Worker: 'readonly',
        URL: 'readonly',
        setTimeout: 'readonly',
        DragEvent: 'readonly',
        KeyboardEvent: 'readonly',
        HTMLElement: 'readonly',
        HTMLInputElement: 'readonly',
        MediaQueryListEvent: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
    }
  },
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: {
        svelteConfig
      }
    }
  },
  {
    ignores: ['build/', '.svelte-kit/', 'dist/', 'static/wasm_exec.js']
  }
];
