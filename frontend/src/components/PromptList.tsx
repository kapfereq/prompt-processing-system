import { useMemo, useState } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  Inbox,
  LoaderCircle,
  RotateCw,
} from 'lucide-react'
import type { PromptDto, PromptStatus } from '../api'

const statusDetails: Record<
  PromptStatus,
  { icon: typeof Clock3; label: string }
> = {
  Pending: { icon: Clock3, label: 'Pending' },
  Processing: { icon: LoaderCircle, label: 'Processing' },
  Completed: { icon: CheckCircle2, label: 'Completed' },
  Failed: { icon: CircleAlert, label: 'Failed' },
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

interface PromptListProps {
  error: Error | null
  isFetching: boolean
  isPending: boolean
  onRetry: () => void
  prompts: PromptDto[] | undefined
}

export function PromptList({
  error,
  isFetching,
  isPending,
  onRetry,
  prompts,
}: PromptListProps) {
  const sortedPrompts = useMemo(
    () =>
      [...(prompts ?? [])].sort(
        (first, second) =>
          new Date(second.createdAt).getTime() -
          new Date(first.createdAt).getTime(),
      ),
    [prompts],
  )
  const hasCachedData = prompts !== undefined
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

      {!isPending && error && !hasCachedData && (
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

      {!isPending && error && hasCachedData && (
        <div className="sync-warning" role="status">
          <CircleAlert aria-hidden="true" size={17} />
          <span>Couldn’t refresh the queue. Showing the last known state.</span>
          <button onClick={onRetry} type="button">Retry</button>
        </div>
      )}

      {!isPending && hasCachedData && sortedPrompts.length === 0 && (
        <div className="state-card empty-state">
          <Inbox aria-hidden="true" size={29} />
          <h3>No prompts yet</h3>
          <p>Your submitted batches will appear here.</p>
        </div>
      )}

      {!isPending && hasCachedData && sortedPrompts.length > 0 && (
        <div className="task-list">
          {sortedPrompts.map((prompt) => (
            <PromptCard key={prompt.id} prompt={prompt} />
          ))}
        </div>
      )}
    </section>
  )
}
