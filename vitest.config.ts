import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Compile .tsx tests with React's automatic JSX runtime (no `import React`).
  esbuild: { jsx: 'automatic' },
  test: {
    // Logic/service tests run in Node with chrome + fetch mocked — no browser.
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    // A dummy key so aiProvider gets past its "no key" guard and reaches the
    // mocked fetch. Tests never make a real network call.
    env: { VITE_ANTHROPIC_API_KEY: 'test-key' },
  },
})
