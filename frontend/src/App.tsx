import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchPrompts,
  getPromptPollInterval,
  submitPrompts,
  type PromptDto,
} from './api'
import { PromptComposer } from './components/PromptComposer'
import { PromptList } from './components/PromptList'
import './App.css'

const PROMPTS_QUERY_KEY = ['prompts'] as const

function App() {
  const queryClient = useQueryClient()
  const [notice, setNotice] = useState<string | null>(null)

  const promptsQuery = useQuery({
    queryKey: PROMPTS_QUERY_KEY,
    queryFn: ({ signal }) => fetchPrompts(signal),
    refetchInterval: (query) => getPromptPollInterval(query.state.data),
    refetchIntervalInBackground: false,
  })

  const createPrompts = useMutation({
    mutationFn: submitPrompts,
    onMutate: () => setNotice(null),
    onSuccess: (created) => {
      queryClient.setQueryData<PromptDto[]>(PROMPTS_QUERY_KEY, (existing) => {
        const createdIds = new Set(created.map(({ id }) => id))
        return [
          ...created,
          ...(existing ?? []).filter(({ id }) => !createdIds.has(id)),
        ]
      })
    },
  })

  const handleSubmit = async (prompts: string[]) => {
    const created = await createPrompts.mutateAsync(prompts)
    setNotice(
      `${created.length} ${created.length === 1 ? 'prompt' : 'prompts'} queued successfully.`,
    )
  }

  const handleEdit = () => {
    if (notice) setNotice(null)
    if (createPrompts.error) createPrompts.reset()
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-inner">
          <div>
            <h1>Prompt processing</h1>
            <p>Submit and monitor asynchronous language model jobs.</p>
          </div>
          <div
            className="processing-path"
            aria-label="Processing path: API, queue, worker"
          >
            <span className="path-step">API</span>
            <span className="path-line" aria-hidden="true" />
            <span className="path-step">QUEUE</span>
            <span className="path-line" aria-hidden="true" />
            <span className="path-step">WORKER</span>
          </div>
        </div>
      </header>

      <main className="workspace">
        <PromptComposer
          error={createPrompts.error}
          isSubmitting={createPrompts.isPending}
          notice={notice}
          onEdit={handleEdit}
          onSubmit={handleSubmit}
        />
        <PromptList
          error={promptsQuery.error}
          isFetching={promptsQuery.isFetching}
          isPending={promptsQuery.isPending}
          onRetry={() => void promptsQuery.refetch()}
          prompts={promptsQuery.data}
        />
      </main>
    </div>
  )
}

export default App
