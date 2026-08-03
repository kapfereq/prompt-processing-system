import { useState } from 'react'
import { Activity, Layers3 } from 'lucide-react'
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
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Prompt Desk home">
          <span className="brand-mark">
            <Layers3 aria-hidden="true" size={19} />
          </span>
          <span>
            Prompt Desk
            <small>Batch processor</small>
          </span>
        </a>
        <div className="header-context">
          <Activity aria-hidden="true" size={15} />
          Processing workspace
        </div>
      </header>

      <main className="workspace" id="top">
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
