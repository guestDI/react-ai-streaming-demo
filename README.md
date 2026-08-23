# React AI streaming demo

A minimal Next.js app that streams OpenAI text deltas through a server route and renders them incrementally in React.

## Run it

```bash
npm install
cp .env.example .env.local
# Add your OPENAI_API_KEY to .env.local
npm run dev
```

Open <http://localhost:3000>.

### Test without an API key

Set this in `.env.local`:

```bash
MOCK_AI=1
```

The route will send a deterministic answer one word at a time, exercising the same browser streaming and cancellation code without calling OpenAI. Remove `MOCK_AI` or set it to `0` to test the real API.

## What to inspect

- `app/api/chat/route.ts`: converts typed OpenAI events to a plain UTF-8 response stream.
- `app/use-streaming-answer.ts`: reads, decodes, batches, and cancels the stream.
- `app/streaming-chat.tsx`: renders the prompt, status, partial answer, Stop action, and error.

This is intentionally small. Add your own authentication, authorization, rate limits, input policy, persistence, and observability before using it in production.
