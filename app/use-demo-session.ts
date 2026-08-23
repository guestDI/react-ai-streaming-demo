'use client';

import { useCallback, useEffect, useState } from 'react';

type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

export function useDemoSession() {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/session', { credentials: 'same-origin' })
      .then((response) => response.json())
      .then((body: { authenticated?: boolean }) => {
        setStatus(body.authenticated ? 'authenticated' : 'unauthenticated');
      })
      .catch(() => {
        setError('Could not check the session');
        setStatus('unauthenticated');
      });
  }, []);

  const login = useCallback(async (accessCode: string) => {
    setError(null);
    const response = await fetch('/api/session', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessCode }),
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error ?? 'Sign-in failed');
      return false;
    }

    setStatus('authenticated');
    return true;
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/session', {
      method: 'DELETE',
      credentials: 'same-origin',
    }).catch(() => {});
    setStatus('unauthenticated');
  }, []);

  return { status, error, login, logout };
}
