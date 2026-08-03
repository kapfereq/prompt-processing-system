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

type JobFilter = 'All' | 'Active' | 'Completed' | 'Failed'

const statusDetails: Record<
  PromptStatus,
  { icon: typeof Clock3; label: string }
> = {
  Pending: { icon: Clock3, label: 'Pending' },
  Processing: { icon: LoaderCircle, label: 'Processing' },
  Completed: { icon: CheckCircle2, label: 'Completed' },
  Failed: { icon: CircleAlert, label: 'Failed' },
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  month: 'short',
})

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

function formatDate(value: string | null) {
  if (!value) return '—'

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Recently' : dateFormatter.format(date)
}

function formatDuration(start: string | null, end: string | null) {
  if (!start || !end) return '—'

  const milliseconds = new Date(end).getTime() - new Date(start).getTime()
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return '—'
  if (milliseconds < 1_000) return `${Math.round(milliseconds)} ms`

  const seconds = milliseconds / 1_000
  if (seconds < 10) return `${seconds.toFixed(1)} s`
  if (seconds < 60) return `${Math.round(seconds)} s`

  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`
}

function matchesFilter(prompt: PromptDto, filter: JobFilter) {
  if (filter === 'Active') {
    return prompt.status === 'Pending' || prompt.status === 'Processing'
  }

  return filter === 'All' || prompt.status === filter
}

function PromptCard({ prompt }: { prompt: PromptDto }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const detailId = `prompt-detail-${prompt.id}`
  const submittedAt = formatDate(prompt.createdAt)
  const queueTime = formatDuration(prompt.createdAt, prompt.startedAt)
  const runTime = formatDuration(prompt.startedAt, prompt.completedAt)

  return (
    <article
      className={isExpanded ? 'job-row job-row-open' : 'job-row'}
      role="listitem"
    >
      <button
        aria-controls={detailId}
        aria-expanded={isExpanded}
        className="job-summary"
        onClick={() => setIsExpanded((current) => !current)}
        type="button"
      >
        <span className="job-status-cell">
          <StatusBadge status={prompt.status} />
        </span>
        <span className="job-prompt-cell">{prompt.content}</span>
        <time
          aria-label={`Submitted ${submittedAt}`}
          className="job-time-cell"
          dateTime={prompt.createdAt}
        >
          {submittedAt}
        </time>
        <span className="job-duration-cell">{runTime}</span>
        <ChevronDown
          aria-hidden="true"
          className={`chevron ${isExpanded ? 'chevron-open' : ''}`}
          size={18}
        />
      </button>

      {isExpanded && (
        <div className="job-detail" id={detailId}>
          <div className="job-detail-content">
            <section className="prompt-block">
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
                {prompt.status === 'Processing' ? (
                  <LoaderCircle aria-hidden="true" className="spin" size={18} />
                ) : (
                  <Clock3 aria-hidden="true" size={18} />
                )}
                <div>
                  <h3>
                    {prompt.status === 'Pending'
                      ? 'Waiting in the queue'
                      : 'Processing now'}
                  </h3>
                  <p>This job will update automatically.</p>
                </div>
              </section>
            )}
          </div>

          <dl className="job-metadata">
            <div>
              <dt>Job ID</dt>
              <dd>
                <code>{prompt.id}</code>
              </dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{submittedAt}</dd>
            </div>
            <div>
              <dt>Queue time</dt>
              <dd>{queueTime}</dd>
            </div>
            <div>
              <dt>Run time</dt>
              <dd>{runTime}</dd>
            </div>
          </dl>
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
  const [filter, setFilter] = useState<JobFilter>('All')
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
  const counts = useMemo(
    () => ({
      Active: sortedPrompts.filter(
        ({ status }) => status === 'Pending' || status === 'Processing',
      ).length,
      All: sortedPrompts.length,
      Completed: sortedPrompts.filter(({ status }) => status === 'Completed')
        .length,
      Failed: sortedPrompts.filter(({ status }) => status === 'Failed').length,
    }),
    [sortedPrompts],
  )
  const visiblePrompts = sortedPrompts.filter((prompt) =>
    matchesFilter(prompt, filter),
  )
  const filters: JobFilter[] = ['All', 'Active', 'Completed', 'Failed']

  return (
    <section className="jobs-section" aria-labelledby="jobs-title">
      <header className="section-heading jobs-heading">
        <div>
          <h2 id="jobs-title">Jobs</h2>
          <p>Newest submissions first.</p>
        </div>
        {isFetching && !isPending && (
          <span className="sync-label" aria-live="polite">
            <RotateCw aria-hidden="true" className="spin" size={14} />
            Syncing
          </span>
        )}
      </header>

      {isPending && (
        <div className="state-card" role="status">
          <LoaderCircle aria-hidden="true" className="spin" size={24} />
          <h3>Loading jobs</h3>
        </div>
      )}

      {!isPending && error && !hasCachedData && (
        <div className="state-card error-state" role="alert">
          <CircleAlert aria-hidden="true" size={26} />
          <h3>Couldn’t load jobs</h3>
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
          <span>Refresh failed. Showing the last known state.</span>
          <button onClick={onRetry} type="button">Retry</button>
        </div>
      )}

      {!isPending && hasCachedData && sortedPrompts.length === 0 && (
        <div className="state-card empty-state">
          <Inbox aria-hidden="true" size={28} />
          <h3>No jobs yet</h3>
          <p>Submitted prompts will appear here.</p>
        </div>
      )}

      {!isPending && hasCachedData && sortedPrompts.length > 0 && (
        <>
          <div
            className="status-filters"
            aria-label="Filter jobs by status"
            role="group"
          >
            {filters.map((option) => (
              <button
                aria-label={`${option}: ${counts[option]} ${
                  counts[option] === 1 ? 'job' : 'jobs'
                }`}
                aria-pressed={filter === option}
                key={option}
                onClick={() => setFilter(option)}
                type="button"
              >
                {option}
                <span>{counts[option]}</span>
              </button>
            ))}
          </div>

          {visiblePrompts.length === 0 ? (
            <div className="filtered-empty" role="status">
              No {filter.toLowerCase()} jobs.
            </div>
          ) : (
            <div className="job-table">
              <div className="job-columns" aria-hidden="true">
                <span>Status</span>
                <span>Prompt</span>
                <span>Submitted</span>
                <span>Duration</span>
                <span />
              </div>
              <div className="job-list" role="list">
                {visiblePrompts.map((prompt) => (
                  <PromptCard key={prompt.id} prompt={prompt} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}
