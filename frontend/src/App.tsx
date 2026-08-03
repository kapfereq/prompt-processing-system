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

  return (
    <div className="app-shell">
      <header className="page-header">
        <h1>Prompt processing</h1>
        <p>Submit prompts and track every job from queue to result.</p>
      </header>

      <main className="workspace">
        <PromptComposer
          error={createPrompts.error}
          isSubmitting={createPrompts.isPending}
          notice={notice}
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
