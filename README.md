# React AI streaming demo

A small Next.js app that streams OpenAI text deltas through a guarded server route and renders them incrementally in React.

The repository includes compact examples of controls that are easy to miss in streaming demos: a signed session, same-origin checks, rate and concurrency limits, input moderation, token-usage logs, cancellation propagation, and response security headers.

## Run it

```bash
npm install
cp .env.example .env.local
# Configure the values described below.
npm run dev
```

Open <http://localhost:3000>.

Required local values:

```bash
DEMO_ACCESS_CODE=choose_a_long_random_access_code
SESSION_SECRET=replace_with_output_from_openssl_rand
```

Generate a cookie-signing secret with:

```bash
openssl rand -base64 32
```

Enter `DEMO_ACCESS_CODE` in the sign-in screen. The server returns a signed, HttpOnly, SameSite cookie; the access code is not stored in browser JavaScript.

### Test without an API key

Set this in `.env.local`:

```bash
MOCK_AI=1
```

The route will send a deterministic answer one word at a time, exercising the same browser streaming and cancellation code without calling OpenAI. Remove `MOCK_AI` or set it to `0` to test the real API.

Authentication, origin checks, rate limits, and concurrency limits still run in mock mode.

## What to inspect

- `app/api/chat/route.ts`: converts typed OpenAI events to a plain UTF-8 response stream.
- `app/api/session/route.ts`: exchanges the configured access code for a signed session cookie.
- `app/use-streaming-answer.ts`: reads, decodes, batches, and cancels the stream.
- `app/use-demo-session.ts`: checks, creates, and clears the browser session.
- `app/streaming-chat.tsx`: renders the prompt, status, partial answer, Stop action, and error.
- `lib/auth.ts`: signs and verifies sessions and creates privacy-preserving caller IDs.
- `lib/request-guards.ts`: enforces same-origin requests plus demo rate and concurrency limits.
- `lib/telemetry.ts`: emits structured request and token-usage events without prompt content.
- `next.config.ts`: applies CSP, frame, content-type, referrer, permissions, and production HSTS headers.

## Security examples included

### Authentication

`/api/chat` requires a valid signed session cookie. The included access-code flow is useful for a private demo or workshop, but it is not a multi-user identity system. Sign-in attempts are limited by the apparent client address. Replace the example with your application's real authentication and authorization before production use.

### Rate and concurrency limiting

Each session is limited to five requests per minute and two active generations. The limiter is deliberately dependency-free and stored in process memory so the behavior is easy to inspect.

In-memory limits are not shared across server instances and reset on restart. Use a shared atomic store or an edge/provider rate limiter in a horizontally scaled deployment. Limits should be tied to a real user or account, not only an IP address.

### Input and abuse controls

The server validates prompt type and length, rejects invalid control characters, calls `omni-moderation-latest`, caps model output, and sends a hashed `safety_identifier` with the OpenAI request.

Moderation is not a prompt-injection solution. The demo model has no tools or private retrieval data. If tools, RAG, or side effects are added, enforce authorization and data boundaries in application code and treat prompts, retrieved documents, and model output as untrusted.

### Usage observability

The route logs a request ID, hashed caller ID, model, status, duration, and token totals from the completed response. It intentionally does not log prompt or answer content.

Token logs are the input to cost monitoring, not a complete billing system. Export them to your observability stack, join them with current model pricing, and configure provider budget alerts.

### Headers and cross-origin requests

`next.config.ts` sets a baseline security-header policy. The API routes also reject an explicit cross-origin `Origin` or `Sec-Fetch-Site: cross-site` request and do not return permissive CORS headers.

CORS and origin checks are not authentication. Non-browser clients can omit or forge those headers, which is why the session and rate limits remain necessary.

## Important limitations

- The access-code login is shared and intended only as a readable example.
- Address-based login limits trust forwarding headers; configure the deployment proxy to replace rather than append untrusted client values.
- Session revocation is limited to expiry, cookie deletion, or rotation of `SESSION_SECRET`.
- Rate and concurrency state is local to one Node.js process.
- Structured logs go to stdout and need a real log sink and alerts.
- The CSP permits inline scripts for compatibility with this minimal Next.js setup. A production app can use nonces for a stricter policy.
- Output moderation and product-specific safety policy may still be required.
- No control in this demo replaces a threat model or security review.

The OpenAI safety controls follow the current [official OpenAI safety guidance](https://developers.openai.com/api/docs/guides/safety-best-practices), including user registration, input constraints, moderation, adversarial testing, and privacy-preserving safety identifiers.
