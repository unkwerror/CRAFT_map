'use client'

import { useEffect, useId, useRef, useState } from 'react'

interface ReportIssueProps {
  objectId: string
  title?: string
}

type SubmissionState = 'idle' | 'pending' | 'success' | 'error'
type InvalidField = 'message' | 'contact' | null

interface ApiErrorBody {
  error?: string
  message?: string
}

const MIN_MESSAGE_LENGTH = 10
const MAX_MESSAGE_LENGTH = 2000
const MAX_CONTACT_LENGTH = 300

function responseErrorMessage(status: number, body: ApiErrorBody | null): string {
  const apiMessage = body?.error || body?.message
  if (apiMessage) return apiMessage
  if (status === 429) return 'Слишком много попыток. Пожалуйста, попробуйте отправить сообщение позже.'
  return 'Не удалось отправить сообщение. Проверьте подключение и попробуйте ещё раз.'
}

/** Доступная публичная форма сообщения об ошибке в данных объекта. */
export default function ReportIssue({ objectId, title }: ReportIssueProps) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [contact, setContact] = useState('')
  const [website, setWebsite] = useState('')
  const [submissionState, setSubmissionState] = useState<SubmissionState>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [invalidField, setInvalidField] = useState<InvalidField>(null)

  const regionId = useId()
  const headingId = useId()
  const messageId = useId()
  const messageHelpId = useId()
  const contactId = useId()
  const contactHelpId = useId()
  const errorId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const messageRef = useRef<HTMLTextAreaElement>(null)
  const contactRef = useRef<HTMLInputElement>(null)
  const successRef = useRef<HTMLDivElement>(null)
  const requestRef = useRef<AbortController | null>(null)

  const pending = submissionState === 'pending'
  const messageLength = Array.from(message).length

  useEffect(() => () => requestRef.current?.abort(), [])

  useEffect(() => {
    if (open) messageRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (submissionState === 'success') successRef.current?.focus()
  }, [submissionState])

  function clearError() {
    if (submissionState === 'error') setSubmissionState('idle')
    if (errorMessage) setErrorMessage('')
    if (invalidField) setInvalidField(null)
  }

  function openForm() {
    setOpen(true)
  }

  function closeForm() {
    requestRef.current?.abort()
    requestRef.current = null
    setOpen(false)
    setSubmissionState('idle')
    setErrorMessage('')
    setInvalidField(null)
    triggerRef.current?.focus()
  }

  function startAnotherReport() {
    setMessage('')
    setContact('')
    setWebsite('')
    setSubmissionState('idle')
    setErrorMessage('')
    setInvalidField(null)
    window.requestAnimationFrame(() => messageRef.current?.focus())
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedMessage = message.trim()
    const trimmedContact = contact.trim()

    if (Array.from(trimmedMessage).length < MIN_MESSAGE_LENGTH) {
      setSubmissionState('error')
      setErrorMessage(`Опишите ошибку подробнее — минимум ${MIN_MESSAGE_LENGTH} символов.`)
      setInvalidField('message')
      messageRef.current?.focus()
      return
    }
    if (Array.from(trimmedMessage).length > MAX_MESSAGE_LENGTH) {
      setSubmissionState('error')
      setErrorMessage(`Сократите сообщение до ${MAX_MESSAGE_LENGTH} символов.`)
      setInvalidField('message')
      messageRef.current?.focus()
      return
    }
    if (trimmedContact.length > MAX_CONTACT_LENGTH) {
      setSubmissionState('error')
      setErrorMessage(`Сократите контакт до ${MAX_CONTACT_LENGTH} символов.`)
      setInvalidField('contact')
      contactRef.current?.focus()
      return
    }

    const controller = new AbortController()
    requestRef.current?.abort()
    requestRef.current = controller
    setSubmissionState('pending')
    setErrorMessage('')
    setInvalidField(null)

    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objectId,
          message: trimmedMessage,
          ...(trimmedContact ? { contact: trimmedContact } : {}),
          website,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        let body: ApiErrorBody | null = null
        try {
          body = (await response.json()) as ApiErrorBody
        } catch {
          // Ответ без JSON всё равно получает понятное пользователю сообщение ниже.
        }
        throw new Error(responseErrorMessage(response.status, body))
      }

      setSubmissionState('success')
      setMessage('')
      setContact('')
      setWebsite('')
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      setSubmissionState('error')
      setInvalidField(null)
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Не удалось отправить сообщение. Попробуйте ещё раз.'
      )
    } finally {
      if (requestRef.current === controller) requestRef.current = null
    }
  }

  return (
    <section className="rounded-xl border border-[var(--hairline)] bg-white/[0.025] p-3.5">
      <button
        ref={triggerRef}
        type="button"
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-1 text-left text-sm font-semibold text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
        aria-expanded={open}
        aria-controls={regionId}
        onClick={open ? closeForm : openForm}
      >
        <span>Сообщить об ошибке</span>
        <span aria-hidden className={`text-base transition-transform ${open ? 'rotate-45' : ''}`}>+</span>
      </button>

      {open && (
        <div
          id={regionId}
          role="region"
          aria-labelledby={headingId}
          className="mt-3 border-t border-[var(--hairline)] pt-4"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation()
              closeForm()
            }
          }}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 id={headingId} className="text-base font-semibold text-[var(--ink)]">
                Сообщить об ошибке
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-[var(--ink-muted)]">
                {title ? `Объект: ${title}. ` : ''}Мы проверим информацию и исправим неточность.
              </p>
            </div>
            <button
              type="button"
              onClick={closeForm}
              aria-label="Закрыть форму сообщения об ошибке"
              className="btn-ghost -mr-1 -mt-1 h-10 w-10 shrink-0 text-lg"
            >
              <span aria-hidden>×</span>
            </button>
          </div>

          {submissionState === 'success' ? (
            <div
              ref={successRef}
              tabIndex={-1}
              role="status"
              className="rounded-xl border border-emerald-300/25 bg-emerald-300/10 p-4 outline-none"
            >
              <p className="font-semibold text-emerald-200">Спасибо! Сообщение отправлено.</p>
              <p className="mt-1 text-sm leading-relaxed text-[var(--ink-muted)]">
                Мы проверим информацию об объекте.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="btn-accent min-h-11 rounded-xl px-4 text-sm"
                >
                  Закрыть
                </button>
                <button
                  type="button"
                  onClick={startAnotherReport}
                  className="min-h-11 rounded-xl border border-[var(--hairline-strong)] px-4 text-sm font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)]"
                >
                  Сообщить ещё
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} noValidate aria-busy={pending}>
              <div>
                <label htmlFor={messageId} className="block text-sm font-semibold text-[var(--ink)]">
                  Что нужно исправить?
                </label>
                <textarea
                  ref={messageRef}
                  id={messageId}
                  name="message"
                  value={message}
                  onChange={(event) => {
                    setMessage(event.target.value)
                    clearError()
                  }}
                  minLength={MIN_MESSAGE_LENGTH}
                  maxLength={MAX_MESSAGE_LENGTH * 2}
                  required
                  disabled={pending}
                  rows={5}
                  aria-describedby={`${messageHelpId}${invalidField === 'message' ? ` ${errorId}` : ''}`}
                  aria-invalid={invalidField === 'message' ? true : undefined}
                  className="field mt-2 min-h-32 resize-y leading-relaxed disabled:cursor-wait disabled:opacity-60"
                />
                <div id={messageHelpId} className="mt-1.5 flex justify-between gap-3 text-xs text-[var(--ink-subtle)]">
                  <span>От 10 до 2000 символов</span>
                  <span aria-label={`${messageLength} из ${MAX_MESSAGE_LENGTH} символов`}>
                    {messageLength}/{MAX_MESSAGE_LENGTH}
                  </span>
                </div>
              </div>

              <div className="mt-4">
                <label htmlFor={contactId} className="block text-sm font-semibold text-[var(--ink)]">
                  Контакт для уточнений <span className="font-normal text-[var(--ink-subtle)]">(необязательно)</span>
                </label>
                <input
                  ref={contactRef}
                  id={contactId}
                  name="contact"
                  type="text"
                  value={contact}
                  onChange={(event) => {
                    setContact(event.target.value)
                    clearError()
                  }}
                  maxLength={MAX_CONTACT_LENGTH}
                  disabled={pending}
                  autoComplete="off"
                  aria-describedby={`${contactHelpId}${invalidField === 'contact' ? ` ${errorId}` : ''}`}
                  aria-invalid={invalidField === 'contact' ? true : undefined}
                  className="field mt-2 disabled:cursor-wait disabled:opacity-60"
                  placeholder="Почта, телефон или ник"
                />
                <p id={contactHelpId} className="mt-1.5 text-xs leading-relaxed text-[var(--ink-subtle)]">
                  До 300 символов. Контакт не будет опубликован.
                </p>
              </div>

              <div
                aria-hidden="true"
                className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden"
              >
                <label htmlFor={`${regionId}-website`}>Ваш сайт</label>
                <input
                  id={`${regionId}-website`}
                  name="website"
                  type="text"
                  value={website}
                  onChange={(event) => setWebsite(event.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              {submissionState === 'error' && (
                <p id={errorId} role="alert" className="mt-4 rounded-lg border border-red-300/20 bg-red-300/10 px-3 py-2.5 text-sm text-red-200">
                  {errorMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={pending}
                className="btn-accent mt-4 min-h-11 w-full rounded-xl px-4 text-sm disabled:cursor-wait disabled:opacity-60"
              >
                {pending ? 'Отправляем…' : 'Отправить сообщение'}
              </button>
              {pending && (
                <p role="status" className="mt-2 text-center text-xs text-[var(--ink-muted)]">
                  Отправляем сообщение…
                </p>
              )}
            </form>
          )}
        </div>
      )}
    </section>
  )
}
