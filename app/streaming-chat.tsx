'use client';

import { FormEvent, useState } from 'react';
import { useStreamingAnswer } from './use-streaming-answer';

export default function StreamingChat() {
  const [prompt, setPrompt] = useState('Explain React reconciliation with an analogy.');
  const { answer, status, error, generate, stop } = useStreamingAnswer();
  const isStreaming = status === 'streaming';

  function submit(event: FormEvent) {
    event.preventDefault();
    if (prompt.trim()) void generate(prompt);
  }

  return (
    <main className="shell">
      <div className="eyebrow">Web Streams + React</div>
      <h1>Stream an AI answer</h1>
      <p className="intro">The server forwards text deltas as UTF-8 bytes. React renders them as they arrive.</p>

      <form onSubmit={submit} className="card">
        <label htmlFor="prompt">Ask a question</label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          disabled={isStreaming}
          rows={5}
        />

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
