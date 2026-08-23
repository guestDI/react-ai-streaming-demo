'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type StreamStatus = 'idle' | 'streaming' | 'complete' | 'error';

export function useStreamingAnswer() {
  const [answer, setAnswer] = useState('');
  const [status, setStatus] = useState<StreamStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const activeRequest = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    activeRequest.current?.abort();
  }, []);

  useEffect(() => stop, [stop]);

  const generate = useCallback(async (prompt: string) => {
    activeRequest.current?.abort();

    const request = new AbortController();
    activeRequest.current = request;
    setAnswer('');
    setError(null);
    setStatus('streaming');

    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let frame: number | undefined;
    let fullAnswer = '';

    const publish = () => {
      frame = undefined;
      if (activeRequest.current === request) setAnswer(fullAnswer);
    };

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
        signal: request.signal,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${response.status})`);
      }

      reader = response.body?.getReader();
      if (!reader) throw new Error('Response body is not readable');

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        fullAnswer += decoder.decode(value, { stream: true });
        if (frame === undefined) frame = requestAnimationFrame(publish);
      }

      fullAnswer += decoder.decode();
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = undefined;
      if (activeRequest.current === request) {
        setAnswer(fullAnswer);
        setStatus('complete');
      }
    } catch (cause) {
      if (request.signal.aborted) {
        if (activeRequest.current === request) setStatus('idle');
      } else if (activeRequest.current === request) {
        setError(cause instanceof Error ? cause.message : 'Unknown error');
        setStatus('error');
      }
    } finally {
      if (frame !== undefined) cancelAnimationFrame(frame);
      reader?.releaseLock();
      if (activeRequest.current === request) activeRequest.current = null;
    }
  }, []);

  return { answer, status, error, generate, stop };
}
