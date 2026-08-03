import { useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  Inbox,
  Layers3,
  LoaderCircle,
  Plus,
  RotateCw,
  Send,
  Activity,
  Trash2,
} from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchPrompts,
  getPromptPollInterval,
  submitPrompts,
  type PromptDto,
  type PromptStatus,
} from './api'
import './App.css'

const PROMPTS_QUERY_KEY = ['prompts'] as const
const MAX_PROMPTS = 20

interface DraftPrompt {
  id: number
  content: string
}

interface PromptComposerProps {
  error: Error | null
  isSubmitting: boolean
  notice: string | null
  onSubmit: (prompts: string[]) => Promise<void>
}

const statusDetails: Record<
  PromptStatus,
  { icon: typeof Clock3; label: string }
> = {
  Pending: { icon: Clock3, label: 'Pending' },
  Processing: { icon: LoaderCircle, label: 'Processing' },
  Completed: { icon: CheckCircle2, label: 'Completed' },
  Failed: { icon: CircleAlert, label: 'Failed' },
}

function PromptComposer({
  error,
  isSubmitting,
  notice,
  onSubmit,
}: PromptComposerProps) {
  const nextId = useRef(2)
  const [drafts, setDrafts] = useState<DraftPrompt[]>([
    { id: 1, content: '' },
  ])
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  )

  const updatePrompt = (id: number, content: string) => {
    setDrafts((current) =>
      current.map((draft) => (draft.id === id ? { ...draft, content } : draft)),
    )
    setValidationMessage(null)
  }

  const addPrompt = () => {
    if (drafts.length >= MAX_PROMPTS) return

    setDrafts((current) => [
      ...current,
      { id: nextId.current++, content: '' },
    ])
    setValidationMessage(null)
  }

  const removePrompt = (id: number) => {
    if (drafts.length === 1) return
    setDrafts((current) => current.filter((draft) => draft.id !== id))
    setValidationMessage(null)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const prompts = drafts.map(({ content }) => content.trim())

    if (prompts.some((prompt) => prompt.length === 0)) {
      setValidationMessage('Complete or remove every prompt before submitting.')
      return
    }

    setValidationMessage(null)
    try {
      await onSubmit(prompts)
      setDrafts([{ id: nextId.current++, content: '' }])
    } catch {
      // The mutation error is rendered by the parent while the draft is preserved.
    }
  }

  return (
    <aside className="composer-column" aria-labelledby="composer-title">
      <form className="composer-card" onSubmit={handleSubmit}>
        <div className="composer-heading">
          <span className="eyebrow">New batch</span>
          <h1 id="composer-title">Submit prompts</h1>
          <p>Build a batch of up to 20 prompts and follow each result as it runs.</p>
        </div>

        <div className="prompt-fields">
          {drafts.map((draft, index) => (
            <div className="prompt-field" key={draft.id}>
              <div className="field-heading">
                <label htmlFor={`prompt-${draft.id}`}>Prompt {index + 1}</label>
                {drafts.length > 1 && (
                  <button
                    aria-label={`Remove prompt ${index + 1}`}
                    className="icon-button remove-button"
                    onClick={() => removePrompt(draft.id)}
                    type="button"
                  >
                    <Trash2 aria-hidden="true" size={16} />
                  </button>
                )}
              </div>
              <textarea
                aria-invalid={Boolean(validationMessage && !draft.content.trim())}
                id={`prompt-${draft.id}`}
                maxLength={4000}
                onChange={(event) => updatePrompt(draft.id, event.target.value)}
                placeholder="Describe the task you want processed…"
                rows={4}
                value={draft.content}
              />
              <span className="character-count" aria-hidden="true">
                {draft.content.length.toLocaleString()} / 4,000
              </span>
            </div>
          ))}
        </div>

        <button
          className="add-button"
          disabled={drafts.length >= MAX_PROMPTS || isSubmitting}
          onClick={addPrompt}
          type="button"
        >
          <Plus aria-hidden="true" size={17} />
          Add another prompt
          <span>{drafts.length}/{MAX_PROMPTS}</span>
        </button>

        {validationMessage && (
          <p className="form-message error-message" role="alert">
            <AlertCircle aria-hidden="true" size={16} />
            {validationMessage}
          </p>
        )}
        {error && (
          <p className="form-message error-message" role="alert">
            <AlertCircle aria-hidden="true" size={16} />
            {error.message}
          </p>
        )}
        {notice && !error && (
          <p className="form-message success-message" role="status">
            <CheckCircle2 aria-hidden="true" size={16} />
            {notice}
          </p>
        )}

        <button className="submit-button" disabled={isSubmitting} type="submit">
          {isSubmitting ? (
            <LoaderCircle aria-hidden="true" className="spin" size={18} />
          ) : (
            <Send aria-hidden="true" size={18} />
          )}
          {isSubmitting ? 'Submitting batch…' : 'Queue batch'}
          <span className="submit-count">{drafts.length}</span>
        </button>
      </form>
    </aside>
  )
}

function StatusBadge({ status }: { status: PromptStatus }) {
  const { icon: Icon, label } = statusDetails[status]

  return (
    <span
      aria-label={`Status: ${label}`}
      className={`status-badge status-${status.toLowerCase()}`}
    >
      <Icon
        aria-hidden="true"
        className={status === 'Processing' ? 'spin' : undefined}
        size={14}
      />
      {label}
    </span>
  )
}

function formatSubmittedAt(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Submitted recently'

  return `Submitted ${new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)}`
}

function PromptCard({ prompt }: { prompt: PromptDto }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const detailId = `prompt-detail-${prompt.id}`

  return (
    <article className={`task-card task-${prompt.status.toLowerCase()}`}>
      <button
        aria-controls={detailId}
        aria-expanded={isExpanded}
        className="task-summary"
        onClick={() => setIsExpanded((current) => !current)}
        type="button"
      >
        <div className="task-main">
          <StatusBadge status={prompt.status} />
          <p>{prompt.content}</p>
          <span className="task-time">{formatSubmittedAt(prompt.createdAt)}</span>
        </div>
        <ChevronDown
          aria-hidden="true"
          className={`chevron ${isExpanded ? 'chevron-open' : ''}`}
          size={20}
        />
      </button>

      {isExpanded && (
        <div className="task-detail" id={detailId}>
          <section>
            <h3>Prompt</h3>
            <p className="preserve-lines">{prompt.content}</p>
          </section>

          {prompt.status === 'Completed' && (
            <section className="result-block">
              <h3>Result</h3>
              <p className="preserve-lines">
                {prompt.result || 'Completed without a response.'}
              </p>
            </section>
          )}

          {prompt.status === 'Failed' && (
            <section className="failure-block" role="alert">
              <h3>Processing failed</h3>
              <p>{prompt.errorMessage || 'No error details were provided.'}</p>
            </section>
          )}

          {(prompt.status === 'Pending' || prompt.status === 'Processing') && (
            <section className="progress-block">
              <LoaderCircle aria-hidden="true" className="spin" size={18} />
              <div>
                <h3>
                  {prompt.status === 'Pending'
                    ? 'Waiting in the queue'
                    : 'Processing now'}
                </h3>
                <p>This card will update automatically.</p>
              </div>
            </section>
          )}
        </div>
      )}
    </article>
  )
}

interface TaskListProps {
  error: Error | null
  isFetching: boolean
  isPending: boolean
  onRetry: () => void
  prompts: PromptDto[] | undefined
}

function TaskList({
  error,
  isFetching,
  isPending,
  onRetry,
  prompts,
}: TaskListProps) {
  const sortedPrompts = useMemo(
    () =>
      [...(prompts ?? [])].sort(
        (first, second) =>
          new Date(second.createdAt).getTime() -
          new Date(first.createdAt).getTime(),
      ),
    [prompts],
  )
  const activeCount = sortedPrompts.filter(
    ({ status }) => status === 'Pending' || status === 'Processing',
  ).length

  return (
    <section className="tasks-column" aria-labelledby="tasks-title">
      <div className="tasks-heading">
        <div>
          <span className="eyebrow">Queue</span>
          <h2 id="tasks-title">Recent prompts</h2>
        </div>
        <div className="queue-meta" aria-live="polite">
          {isFetching && !isPending ? (
            <span className="sync-label">
              <RotateCw aria-hidden="true" className="spin" size={14} />
              Syncing
            </span>
          ) : activeCount > 0 ? (
            <span className="active-label">{activeCount} active</span>
          ) : null}
          <span className="total-count">{sortedPrompts.length}</span>
        </div>
      </div>

      {isPending && (
        <div className="state-card" role="status">
          <LoaderCircle aria-hidden="true" className="spin" size={25} />
          <h3>Loading prompts</h3>
          <p>Checking the latest queue state…</p>
        </div>
      )}

      {!isPending && error && (
        <div className="state-card error-state" role="alert">
          <CircleAlert aria-hidden="true" size={27} />
          <h3>Couldn’t load the queue</h3>
          <p>{error.message}</p>
          <button className="retry-button" onClick={onRetry} type="button">
            <RotateCw aria-hidden="true" size={16} />
            Try again
          </button>
        </div>
      )}

      {!isPending && !error && sortedPrompts.length === 0 && (
        <div className="state-card empty-state">
          <Inbox aria-hidden="true" size={29} />
          <h3>No prompts yet</h3>
          <p>Your submitted batches will appear here.</p>
        </div>
      )}

      {!isPending && !error && sortedPrompts.length > 0 && (
        <div className="task-list">
          {sortedPrompts.map((prompt) => (
            <PromptCard key={prompt.id} prompt={prompt} />
          ))}
        </div>
      )}
    </section>
  )
}

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
        return [...created, ...(existing ?? []).filter(({ id }) => !createdIds.has(id))]
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
        <TaskList
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
