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
const apiBaseUrl = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
const promptsUrl = `${apiBaseUrl}/api/prompts`

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
  if (!Array.isArray(body)) {
    throw new Error('The server returned an unexpected response.')
  }

  return body as PromptDto[]
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
