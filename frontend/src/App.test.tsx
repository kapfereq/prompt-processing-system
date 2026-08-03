import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { getPromptPollInterval, type PromptDto } from './api'

const makePrompt = (
  id: string,
  status: PromptDto['status'],
): PromptDto => ({
  completedAt: status === 'Completed' || status === 'Failed' ? '2026-08-03T09:01:00Z' : null,
  content: `Prompt ${id}`,
  createdAt: '2026-08-03T09:00:00Z',
  errorMessage: status === 'Failed' ? 'Provider unavailable' : null,
  id,
  result: status === 'Completed' ? 'Finished result' : null,
  startedAt: status === 'Pending' ? null : '2026-08-03T09:00:10Z',
  status,
})

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  )
}

describe('Prompt Desk', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify([]), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }),
      ),
    )
  })

  afterEach(() => vi.unstubAllGlobals())

  it('adds and removes prompt fields', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: /add another prompt/i }))
    expect(screen.getByRole('textbox', { name: 'Prompt 2' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Remove prompt 2' }))
    expect(
      screen.queryByRole('textbox', { name: 'Prompt 2' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Prompt 1' })).toBeInTheDocument()
  })

  it('submits a trimmed batch using the API contract', async () => {
    const created = [makePrompt('one', 'Pending'), makePrompt('two', 'Pending')]
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockImplementation(async (_input, init) =>
      init?.method === 'POST'
        ? new Response(JSON.stringify(created), { status: 202 })
        : new Response(JSON.stringify([]), { status: 200 }),
    )
    const user = userEvent.setup()
    renderApp()

    await user.type(
      screen.getByRole('textbox', { name: 'Prompt 1' }),
      '  First task  ',
    )
    await user.click(screen.getByRole('button', { name: /add another prompt/i }))
    await user.type(
      screen.getByRole('textbox', { name: 'Prompt 2' }),
      'Second task',
    )
    await user.click(screen.getByRole('button', { name: /queue batch/i }))

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')
      expect(postCall).toBeDefined()
      expect(JSON.parse(String(postCall?.[1]?.body))).toEqual({
        prompts: [{ content: 'First task' }, { content: 'Second task' }],
      })
    })
    expect(await screen.findByText('2 prompts queued successfully.')).toBeVisible()
    expect(screen.getAllByLabelText('Status: Pending')).toHaveLength(2)
  })

  it('renders every lifecycle status and an expanded result', async () => {
    const prompts = [
      makePrompt('pending', 'Pending'),
      makePrompt('processing', 'Processing'),
      makePrompt('completed', 'Completed'),
      makePrompt('failed', 'Failed'),
    ]
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(prompts), { status: 200 }),
    )
    const user = userEvent.setup()
    renderApp()

    for (const status of ['Pending', 'Processing', 'Completed', 'Failed']) {
      expect(await screen.findByLabelText(`Status: ${status}`)).toBeVisible()
    }

    const completedCard = screen.getByText('Prompt completed').closest('article')
    expect(completedCard).not.toBeNull()
    await user.click(within(completedCard!).getByRole('button'))
    expect(within(completedCard!).getByText('Finished result')).toBeVisible()
  })

  it('polls only while a prompt is pending or processing', () => {
    expect(getPromptPollInterval([makePrompt('one', 'Pending')])).toBe(1_500)
    expect(getPromptPollInterval([makePrompt('one', 'Processing')])).toBe(1_500)
    expect(getPromptPollInterval([makePrompt('one', 'Completed')])).toBe(false)
    expect(getPromptPollInterval([makePrompt('one', 'Failed')])).toBe(false)
    expect(getPromptPollInterval([])).toBe(false)
  })
})
