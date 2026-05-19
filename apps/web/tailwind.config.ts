import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{html,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        bg: '#0b0d10',
        panel: '#13171c',
        line: '#1f262f',
        ink: '#e6edf3',
        muted: '#7d8590',
        ok: '#3fb950',
        warn: '#d29922',
        err: '#f85149',
        accent: '#58a6ff'
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace']
      }
    }
  }
} satisfies Config;
