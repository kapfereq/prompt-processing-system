import { useRef, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  Plus,
  Send,
  Trash2,
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
  onSubmit: (prompts: string[]) => Promise<void>
}

export function PromptComposer({
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
                aria-describedby={
                  validationMessage && !draft.content.trim()
                    ? 'prompt-validation'
                    : undefined
                }
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
