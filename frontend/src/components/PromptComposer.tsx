import { useRef, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  Plus,
  X,
} from 'lucide-react'

const MAX_PROMPTS = 20

interface DraftPrompt {
  id: number
  content: string
}

interface PromptComposerProps {
  error: Error | null
  isSubmitting: boolean
  notice: string | null
  onEdit: () => void
  onSubmit: (prompts: string[]) => Promise<void>
}

export function PromptComposer({
  error,
  isSubmitting,
  notice,
  onEdit,
  onSubmit,
}: PromptComposerProps) {
  const nextId = useRef(2)
  const [drafts, setDrafts] = useState<DraftPrompt[]>([
    { id: 1, content: '' },
  ])
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  )
  const promptLabel = drafts.length === 1 ? 'prompt' : 'prompts'

  const updatePrompt = (id: number, content: string) => {
    setDrafts((current) =>
      current.map((draft) => (draft.id === id ? { ...draft, content } : draft)),
    )
    setValidationMessage(null)
    onEdit()
  }

  const addPrompt = () => {
    if (drafts.length >= MAX_PROMPTS) return

    setDrafts((current) => [
      ...current,
      { id: nextId.current++, content: '' },
    ])
    setValidationMessage(null)
    onEdit()
  }

  const removePrompt = (id: number) => {
    if (drafts.length === 1) return

    setDrafts((current) => current.filter((draft) => draft.id !== id))
    setValidationMessage(null)
    onEdit()
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
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
    <section className="composer-section" aria-labelledby="composer-title">
      <form className="composer-panel" onSubmit={handleSubmit}>
        <header className="section-heading composer-heading">
          <div>
            <h2 id="composer-title">New batch</h2>
            <p>Each prompt becomes an independent job.</p>
          </div>
          <span className="batch-count">{drafts.length} of {MAX_PROMPTS}</span>
        </header>

        <div className="prompt-fields" role="list">
          {drafts.map((draft, index) => (
            <div className="prompt-row" key={draft.id} role="listitem">
              <span className="prompt-index" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="prompt-control">
                <label className="visually-hidden" htmlFor={`prompt-${draft.id}`}>
                  Prompt {index + 1}
                </label>
                <textarea
                  aria-describedby={
                    validationMessage && !draft.content.trim()
                      ? 'prompt-validation'
                      : undefined
                  }
                  aria-invalid={Boolean(validationMessage && !draft.content.trim())}
                  disabled={isSubmitting}
                  id={`prompt-${draft.id}`}
                  maxLength={4000}
                  onChange={(event) => updatePrompt(draft.id, event.target.value)}
                  placeholder="Enter a prompt…"
                  rows={2}
                  value={draft.content}
                />
                <span className="character-count" aria-hidden="true">
                  {draft.content.length.toLocaleString()} / 4,000
                </span>
              </div>
              {drafts.length > 1 && (
                <button
                  aria-label={`Remove prompt ${index + 1}`}
                  className="remove-button"
                  disabled={isSubmitting}
                  onClick={() => removePrompt(draft.id)}
                  type="button"
                >
                  <X aria-hidden="true" size={17} />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="composer-footer">
          <button
            className="add-button"
            disabled={drafts.length >= MAX_PROMPTS || isSubmitting}
            onClick={addPrompt}
            type="button"
          >
            <Plus aria-hidden="true" size={17} />
            Add prompt
          </button>

          <button className="submit-button" disabled={isSubmitting} type="submit">
            {isSubmitting && (
              <LoaderCircle aria-hidden="true" className="spin" size={17} />
            )}
            {isSubmitting
              ? 'Submitting batch…'
              : `Submit ${drafts.length} ${promptLabel}`}
          </button>
        </div>

        <div className="composer-feedback">
          {validationMessage && (
            <p
              className="form-message error-message"
              id="prompt-validation"
              role="alert"
            >
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
        </div>
      </form>
    </section>
  )
}
