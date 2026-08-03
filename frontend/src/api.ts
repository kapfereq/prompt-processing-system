export type PromptStatus = 'Pending' | 'Processing' | 'Completed' | 'Failed'

export interface PromptDto {
  id: string
  content: string
  status: PromptStatus
  result: string | null
  errorMessage: string | null
  createdAt: string
  startedAt: string | null
  completedAt: string | null
}

const POLL_INTERVAL_MS = 1_500
const promptStatuses = new Set<PromptStatus>([
  'Pending',
  'Processing',
  'Completed',
  'Failed',
])
const apiBaseUrl = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
const promptsUrl = `${apiBaseUrl}/api/prompts`

function isPrompt(value: unknown): value is PromptDto {
  if (!value || typeof value !== 'object') return false

  const prompt = value as Record<string, unknown>
  const nullableString = (field: unknown) =>
    field === null || typeof field === 'string'

  return (
    typeof prompt.id === 'string' &&
    typeof prompt.content === 'string' &&
    typeof prompt.status === 'string' &&
    promptStatuses.has(prompt.status as PromptStatus) &&
    nullableString(prompt.result) &&
    nullableString(prompt.errorMessage) &&
    typeof prompt.createdAt === 'string' &&
    nullableString(prompt.startedAt) &&
    nullableString(prompt.completedAt)
  )
}

async function getErrorMessage(response: Response) {
  const fallback = `Request failed with status ${response.status}.`

  try {
    const body = (await response.json()) as {
      detail?: string
      message?: string
      title?: string
    }
    return body.detail || body.message || body.title || fallback
  } catch {
    return fallback
  }
}

async function readPromptList(response: Response): Promise<PromptDto[]> {
  if (!response.ok) throw new Error(await getErrorMessage(response))

  const body: unknown = await response.json()
  if (!Array.isArray(body) || !body.every(isPrompt)) {
    throw new Error('The server returned an unexpected response.')
  }

  return body
}

export async function fetchPrompts(signal?: AbortSignal) {
  const response = await fetch(promptsUrl, {
    headers: { Accept: 'application/json' },
    signal,
  })

  return readPromptList(response)
}

export async function submitPrompts(contents: string[]) {
  const response = await fetch(promptsUrl, {
    body: JSON.stringify({
      prompts: contents.map((content) => ({ content })),
    }),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })

  return readPromptList(response)
}

export function getPromptPollInterval(prompts: PromptDto[] | undefined) {
  return prompts?.some(
    ({ status }) => status === 'Pending' || status === 'Processing',
  )
    ? POLL_INTERVAL_MS
    : false
}
