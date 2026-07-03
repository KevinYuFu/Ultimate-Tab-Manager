// Low-level AI call used by aiSort. This is the swappable seam: in dev the
// extension calls Anthropic directly with a locally-stored key; a future prod
// build points the same function at a backend proxy that holds the key and
// checks the user's subscription — nothing above this file changes.

const MODEL = 'claude-haiku-4-5'
const API_URL = 'https://api.anthropic.com/v1/messages'

// The model works on plain indices, not our UUIDs — fewer tokens, and it can't
// hallucinate an id that doesn't exist.
export type SortRequest = {
  tabs: { index: number; name: string; host: string }[]
  bins: { index: number; name: string }[]
}

// For each tab index, the chosen existing-bin index (or -1 when none fit).
export type SortAssignment = { tab: number; bin: number }

async function getApiKey(): Promise<string | null> {
  const { aiApiKey } = await chrome.storage.local.get('aiApiKey')
  return typeof aiApiKey === 'string' && aiApiKey.trim() ? aiApiKey.trim() : null
}

// Ask the model which existing bin each tab belongs to. Uses a forced tool call
// so the response is guaranteed-valid structured JSON. Throws on any failure;
// the caller (aiSort) treats a throw as "sort nothing".
export async function requestSort(req: SortRequest): Promise<SortAssignment[]> {
  const key = await getApiKey()
  if (!key) throw new Error('No API key configured')

  const system =
    "You organize browser tabs into the user's existing bins (folders) by topic. " +
    'For each tab, pick the single existing bin it best fits. Only assign a tab to a ' +
    'bin when it clearly belongs there; if no bin is a good fit, use -1. Never force a weak match.'

  const binLines = req.bins.map(b => `${b.index}: ${b.name}`).join('\n')
  const tabLines = req.tabs.map(t => `${t.index}: "${t.name}" (${t.host})`).join('\n')
  const userMsg =
    `Existing bins:\n${binLines}\n\nTabs to sort:\n${tabLines}\n\n` +
    'Return one assignment for every tab.'

  const body = {
    model: MODEL,
    max_tokens: 2048,
    system,
    messages: [{ role: 'user', content: userMsg }],
    tools: [
      {
        name: 'submit_assignments',
        description: 'Record which existing bin each tab belongs to.',
        input_schema: {
          type: 'object',
          properties: {
            assignments: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  tab: { type: 'integer', description: 'the tab index' },
                  bin: {
                    type: 'integer',
                    description: 'the best-fitting existing bin index, or -1 if none fit',
                  },
                },
                required: ['tab', 'bin'],
              },
            },
          },
          required: ['assignments'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'submit_assignments' },
  }

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      // Required to call the API from a browser/extension context.
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`AI request failed: ${res.status}`)

  const data = await res.json()
  const toolUse = (data.content ?? []).find((b: { type?: string }) => b.type === 'tool_use')
  const assignments = toolUse?.input?.assignments
  if (!Array.isArray(assignments)) throw new Error('Malformed AI response')
  return assignments as SortAssignment[]
}
