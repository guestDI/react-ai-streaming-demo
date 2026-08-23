'use client';

import { FormEvent, useState } from 'react';
import { useDemoSession } from './use-demo-session';
import { useStreamingAnswer } from './use-streaming-answer';

export default function StreamingChat() {
  const [prompt, setPrompt] = useState('Explain React reconciliation with an analogy.');
  const [accessCode, setAccessCode] = useState('');
  const session = useDemoSession();
  const { answer, status, error, generate, stop } = useStreamingAnswer();
  const isStreaming = status === 'streaming';

  function submit(event: FormEvent) {
    event.preventDefault();
    if (prompt.trim()) void generate(prompt);
  }

  async function signIn(event: FormEvent) {
    event.preventDefault();
    if (await session.login(accessCode)) setAccessCode('');
  }

  if (session.status === 'loading') {
    return <main className="shell"><p className="intro">Checking session…</p></main>;
  }

  if (session.status === 'unauthenticated') {
    return (
      <main className="shell compact">
        <div className="eyebrow">Protected demo</div>
        <h1>Sign in to stream</h1>
        <p className="intro">
          Enter the access code configured by the server owner. A successful sign-in creates a signed, HttpOnly session cookie.
        </p>

        <form onSubmit={signIn} className="card">
          <label htmlFor="access-code">Demo access code</label>
          <input
            id="access-code"
            type="password"
            value={accessCode}
            onChange={(event) => setAccessCode(event.target.value)}
            autoComplete="current-password"
          />
          <button type="submit" disabled={!accessCode}>Sign in</button>
          {session.error && <p className="error" role="alert">{session.error}</p>}
        </form>
      </main>
    );
  }

  return (
    <main className="shell">
      <div className="topline">
        <div className="eyebrow">Web Streams + React</div>
        <button className="textButton" type="button" onClick={() => void session.logout()}>
          Sign out
        </button>
      </div>
      <h1>Stream an AI answer</h1>
      <p className="intro">The server forwards text deltas as UTF-8 bytes. React renders them as they arrive.</p>

      <form onSubmit={submit} className="card">
        <label htmlFor="prompt">Ask a question</label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          disabled={isStreaming}
          maxLength={10_000}
          rows={5}
        />

        <div className="formMeta">
          <span>{prompt.length.toLocaleString()} / 10,000</span>
          <span>5 requests/minute · 2 concurrent</span>
        </div>

        {isStreaming ? (
          <button className="secondary" type="button" onClick={stop}>Stop</button>
        ) : (
          <button type="submit" disabled={!prompt.trim()}>Generate</button>
        )}
      </form>

      <section className="card answer" aria-live="polite" aria-busy={isStreaming}>
        <div className="answerHeading">
          <h2>Answer</h2>
          <span className={`status ${status}`}>{status}</span>
        </div>
        {answer ? <p>{answer}</p> : <p className="placeholder">The response will appear here.</p>}
        {isStreaming && <span className="cursor" aria-hidden="true" />}
        {error && <p className="error" role="alert">{error}</p>}
      </section>
    </main>
  );
}
