interface ImportMetaEnv {
  // Dev-only Anthropic key, injected from .env at build time. Absent in prod
  // builds (which use the premium proxy instead).
  readonly VITE_ANTHROPIC_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
