import { randomUUID } from 'node:crypto';
import OpenAI from 'openai';
import { readSession, safetyIdentifier } from '@/lib/auth';
import { acquireRequestSlot, isSameOrigin } from '@/lib/request-guards';
import { logRequest } from '@/lib/telemetry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const model = process.env.OPENAI_MODEL ?? 'gpt-5.6';
const MAX_PROMPT_LENGTH = 10_000;
const MAX_OUTPUT_TOKENS = 500;

type FinishRequest = (
  status: 'completed' | 'cancelled' | 'failed' | 'blocked',
  options?: {
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      total_tokens?: number;
    } | null;
    reason?: string;
  },
) => void;

function mockResponse(request: Request, finish: FinishRequest, requestId: string) {
  const encoder = new TextEncoder();
  const words = `Streaming is working. Think of React reconciliation like updating a restaurant order: React compares the new order with the old one, then tells the kitchen only what changed instead of preparing the entire meal again.`.match(/\S+\s*/g) ?? [];

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for (const word of words) {
          if (request.signal.aborted) break;
          controller.enqueue(encoder.encode(word));
          await new Promise((resolve) => setTimeout(resolve, 120));
        }
        controller.close();
        finish(request.signal.aborted ? 'cancelled' : 'completed');
      } catch {
        finish(request.signal.aborted ? 'cancelled' : 'failed');
      }
    },
  });

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Content-Type-Options': 'nosniff',
      'X-Mock-AI': '1',
      'X-Request-Id': requestId,
    },
  });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: 'Cross-origin request rejected' }, { status: 403 });
  }

  const session = readSession(request);
  if (!session) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  const callerId = safetyIdentifier(session.sid);
  const slot = acquireRequestSlot(callerId);

  if (!slot.allowed) {
    return Response.json(
      {
        error: slot.reason === 'concurrency'
          ? 'Too many active generations'
          : 'Rate limit exceeded',
      },
      {
        status: 429,
        headers: { 'Retry-After': String(slot.retryAfter) },
      },
    );
  }

  const requestId = randomUUID();
  const startedAt = Date.now();
  let finished = false;

  const finish: FinishRequest = (status, options = {}) => {
    if (finished) return;
    finished = true;
    slot.release();
    logRequest({
      requestId,
      callerId,
      model,
      startedAt,
      status,
      usage: options.usage,
      reason: options.reason,
    });
  };

  try {
    const { prompt } = (await request.json()) as { prompt?: unknown };

    if (typeof prompt !== 'string' || !prompt.trim()) {
      finish('blocked', { reason: 'invalid_prompt' });
      return Response.json({ error: 'Prompt is required' }, { status: 400 });
    }

    if (prompt.length > MAX_PROMPT_LENGTH) {
      finish('blocked', { reason: 'prompt_too_long' });
      return Response.json({ error: 'Prompt is too long' }, { status: 413 });
    }

    if (prompt.includes('\u0000')) {
      finish('blocked', { reason: 'invalid_control_character' });
      return Response.json({ error: 'Prompt contains invalid characters' }, { status: 400 });
    }

    if (process.env.MOCK_AI === '1') {
      return mockResponse(request, finish, requestId);
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const normalizedPrompt = prompt.trim();

    const moderation = await openai.moderations.create({
      model: 'omni-moderation-latest',
      input: normalizedPrompt,
    });

    if (moderation.results.some((result) => result.flagged)) {
      finish('blocked', { reason: 'moderation' });
      return Response.json({ error: 'Prompt was rejected by the safety check' }, { status: 400 });
    }

    const upstream = await openai.responses.create(
      {
        model,
        input: normalizedPrompt,
        max_output_tokens: MAX_OUTPUT_TOKENS,
        safety_identifier: callerId,
        stream: true,
      },
      { signal: request.signal },
    );

    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        let usage: {
          input_tokens?: number;
          output_tokens?: number;
          total_tokens?: number;
        } | null = null;

        try {
          for await (const event of upstream) {
            if (request.signal.aborted) break;

            if (event.type === 'response.output_text.delta') {
              controller.enqueue(encoder.encode(event.delta));
            }

            if (event.type === 'response.completed') {
              usage = event.response.usage ?? null;
            }
          }

          controller.close();
          finish(request.signal.aborted ? 'cancelled' : 'completed', { usage });
        } catch (error) {
          if (request.signal.aborted) {
            finish('cancelled', { usage });
            return;
          }

          finish('failed', { usage, reason: 'upstream_stream_error' });
          controller.error(error);
        }
      },
    });

    return new Response(body, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Content-Type-Options': 'nosniff',
        'X-Request-Id': requestId,
      },
    });
  } catch (error) {
    finish('failed', { reason: 'request_setup_error' });
    console.error('Failed to start AI stream', { requestId, error });
    return Response.json(
      { error: 'Failed to generate an answer', requestId },
      { status: 500 },
    );
  }
}
