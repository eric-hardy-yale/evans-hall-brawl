import { useEffect, useRef, useState } from 'react'
import { PEOPLE_INFO } from './talk.js'

// Chat with an AI avatar (backend/main.py). Black and pink like the minimap.
// Each conversation (messages + session_id) lives in a module-level Map so it survives
// closing and reopening the panel.
// dev: Vite proxies /api to localhost:8000. Published builds (GitHub Pages, Render) call the Render backend.
export const DEFAULT_API = 'https://evans-hall-brawl-api.onrender.com'
const API = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? '' : DEFAULT_API)
const MAX = 2000
const CONVOS = new Map() // id -> { messages: [{ who: 'me' | 'them' | 'note', text }], sessionId }

function convo(id) {
  if (!CONVOS.has(id)) CONVOS.set(id, { messages: [], sessionId: null })
  return CONVOS.get(id)
}

// tiny markdown: ``` code blocks, `code`, **bold**
function Markdown({ text }) {
  const blocks = text.split(/```(?:[a-zA-Z]*\n)?/)
  return blocks.map((b, i) =>
    i % 2 ? (
      <pre key={i}>
        <code>{b.replace(/\n$/, '')}</code>
      </pre>
    ) : (
      <span key={i}>
        {b.split(/(`[^`]+`|\*\*[^*]+\*\*)/).map((part, j) =>
          part.startsWith('`') && part.endsWith('`') && part.length > 1 ? (
            <code key={j}>{part.slice(1, -1)}</code>
          ) : part.startsWith('**') && part.endsWith('**') && part.length > 3 ? (
            <b key={j}>{part.slice(2, -2)}</b>
          ) : (
            part
          ),
        )}
      </span>
    ),
  )
}

export default function ChatPanel({ id, onClose }) {
  const info = PEOPLE_INFO[id]
  const c = convo(id)
  const [messages, setMessages] = useState(c.messages)
  const [text, setText] = useState('')
  const [waiting, setWaiting] = useState(false)
  const box = useRef()
  const input = useRef()

  useEffect(() => {
    input.current?.focus()
    const esc = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight, behavior: 'smooth' })
  }, [messages, waiting])

  const push = (m) => {
    c.messages = [...c.messages, m]
    setMessages(c.messages)
  }

  async function send() {
    const message = text.trim().slice(0, MAX)
    if (!message || waiting) return
    setText('')
    push({ who: 'me', text: message })
    setWaiting(true)
    // the free Render server naps when idle; the first message can take ~a minute to wake it
    const slow = setTimeout(() => push({ who: 'note', text: 'Waking up the backend (free servers nap when idle). This first reply can take up to a minute…' }), 6000)
    try {
      const res = await fetch(`${API}/api/people/${id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, session_id: c.sessionId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `The backend answered ${res.status}.`)
      }
      const data = await res.json()
      c.sessionId = data.session_id
      push({ who: 'them', text: data.reply })
    } catch (e) {
      const offline = e instanceof TypeError || /Failed to fetch|NetworkError|404/.test(String(e.message))
      const fix = import.meta.env.DEV ? ' Start it with: backend/.venv/bin/python -m uvicorn main:app --app-dir backend --port 8000' : ' Try again in a minute.'
      push({ who: 'note', text: offline ? `Can't reach the backend.${fix}` : e.message })
    } finally {
      clearTimeout(slow)
      setWaiting(false)
      input.current?.focus()
    }
  }

  return (
    <aside className="chat" onMouseDown={(e) => e.stopPropagation()}>
      <header className="chat-head">
        <div>
          <div className="chat-name">{info?.name ?? id}</div>
          <div className="chat-sub">
            AI avatar · {info?.course} · {info?.room}
          </div>
        </div>
        <button className="chat-x" onClick={onClose} aria-label="Close chat">
          ×
        </button>
      </header>
      <div className="chat-body" ref={box}>
        {messages.length === 0 && <div className="chat-note">Say hi. This is an AI avatar, not the real professor.</div>}
        {messages.map((m, i) =>
          m.who === 'note' ? (
            <div key={i} className="chat-note">
              {m.text}
            </div>
          ) : (
            <div key={i} className={`chat-msg ${m.who}`}>
              <Markdown text={m.text} />
            </div>
          ),
        )}
        {waiting && <div className="chat-msg them typing">…</div>}
      </div>
      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <textarea
          ref={input}
          rows={2}
          maxLength={MAX}
          value={text}
          placeholder={`Message ${info?.name ?? id}…`}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
        />
        <button type="submit" disabled={waiting || !text.trim()}>
          Send
        </button>
      </form>
    </aside>
  )
}
