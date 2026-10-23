// Store build only: remove host_permissions from dist/manifest.json. The store
// build has no API key, so it never calls api.anthropic.com and shouldn't ask
// for access to it.
import { readFileSync, writeFileSync } from 'node:fs'

const path = 'dist/manifest.json'
const manifest = JSON.parse(readFileSync(path, 'utf8'))
delete manifest.host_permissions
writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n')
