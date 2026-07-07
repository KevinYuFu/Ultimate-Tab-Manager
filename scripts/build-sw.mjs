// Bundles the background service worker into dist/service-worker.js.
// Runs AFTER `vite build` (which empties dist). esbuild produces a single
// self-contained ESM file — no shared chunks to resolve in the worker context.
// The dev key is injected from .env exactly as Vite injects it into the popup.
import * as esbuild from 'esbuild'

// Load .env if present (dev). Absent in prod builds → key stays empty and the
// worker's AI calls fall back gracefully (a stash never depends on the AI).
try {
  process.loadEnvFile('.env')
} catch {
  /* no .env — fine */
}

await esbuild.build({
  entryPoints: ['src/service-worker.ts'],
  bundle: true,
  format: 'esm',
  outfile: 'dist/service-worker.js',
  define: {
    'import.meta.env.VITE_ANTHROPIC_API_KEY': JSON.stringify(
      process.env.VITE_ANTHROPIC_API_KEY ?? '',
    ),
  },
})

console.log('built dist/service-worker.js')
