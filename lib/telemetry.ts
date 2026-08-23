type Usage = {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
} | null;

type RequestEvent = {
  requestId: string;
  callerId: string;
  model: string;
  startedAt: number;
  status: 'completed' | 'cancelled' | 'failed' | 'blocked';
  usage?: Usage;
  reason?: string;
};

export function logRequest(event: RequestEvent) {
  const { startedAt, ...details } = event;

  console.info(JSON.stringify({
    event: 'ai_request',
    ...details,
    durationMs: Date.now() - startedAt,
    timestamp: new Date().toISOString(),
  }));
}
