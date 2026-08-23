import OpenAI from 'openai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const model = process.env.OPENAI_MODEL ?? 'gpt-5.6';

export async function POST(request: Request) {
  try {
    const { prompt } = (await request.json()) as { prompt?: string };

    if (!prompt?.trim()) {
      return Response.json({ error: 'Prompt is required' }, { status: 400 });
    }

    if (prompt.length > 10_000) {
      return Response.json({ error: 'Prompt is too long' }, { status: 413 });
    }

    if (process.env.MOCK_AI === '1') {
      const encoder = new TextEncoder();
      const words = `Streaming is working. Think of React reconciliation like updating a restaurant order: React compares the new order with the old one, then tells the kitchen only what changed instead of preparing the entire meal again.`.match(/\S+\s*/g) ?? [];

      const body = new ReadableStream<Uint8Array>({
        async start(controller) {
          for (const word of words) {
            if (request.signal.aborted) break;
            controller.enqueue(encoder.encode(word));
            await new Promise((resolve) => setTimeout(resolve, 120));
          }
          controller.close();
        },
      });

      return new Response(body, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'X-Mock-AI': '1',
        },
      });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const upstream = await openai.responses.create(
      {
        model,
        input: prompt.trim(),
        stream: true,
      },
      { signal: request.signal },
    );

    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of upstream) {
            if (request.signal.aborted) break;

            if (event.type === 'response.output_text.delta') {
              controller.enqueue(encoder.encode(event.delta));
            }
          }

          controller.close();
        } catch (error) {
          if (request.signal.aborted) {
            controller.close();
            return;
          }

          controller.error(error);
        }
      },
    });

    return new Response(body, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Failed to start AI stream', error);
    return Response.json({ error: 'Failed to generate an answer' }, { status: 500 });
  }
}
