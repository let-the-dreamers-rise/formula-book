# Friction log

Each entry: task, steps, expected, actual, severity, workaround, suggestion. Written when the problem was hit.

## 1. Testing an add-on against real Alexa+ (21 Oct 2026)

- Task: run the MCP server against Alexa+ before building the demo.
- Steps: read the Alexa+ add-ons home page and the MCP Toolkit pages on developer.amazon.com.
- Expected: a public way to connect a self-hosted MCP server to Alexa+, or a local inspector.
- Actual: the MCP Toolkit and the Local Inspector are available to partners only. There is no public test path.
- Severity: high for this track. Nothing can be tested on real Alexa+.
- Workaround: a labelled simulated Alexa+ web client that is a real MCP client (allowed by the hackathon rules).
- Suggestion: publish the Local Inspector, or a public sandbox that accepts a self-hosted MCP URL, for hackathon entrants.

## 2. Protocol version in the Alexa+ lifecycle sample (21 Oct 2026)

- Task: choose the MCP protocol version and features the server must support.
- Steps: compared the client lifecycle page (`initialize` sample) with the MCP changelog.
- Expected: the sample's protocol version supports every result field the sample uses.
- Actual: the sample sends protocol 2025-03-26 and declares only the `roots` capability, but its tool result carries `structuredContent`. Structured output and elicitation are dated 2025-06-18 in the MCP changelog. It is unclear whether Alexa+ supports elicitation.
- Severity: low.
- Workaround: the server accepts 2025-03-26 and 2025-11-25, always sends `structuredContent`, and sends `elicitation/create` only when the session is 2025-06-18 or later and the client declared `elicitation`. Otherwise it returns a `needs_choice` result.
- Suggestion: state the minimum protocol version for each tool-result feature, and whether Alexa+ declares `elicitation`.

## 4. Security software rewrites local MCP traffic (21 Oct 2026)

- Task: run the server's integration tests and the browser sim against `http://127.0.0.1`.
- Steps: start the server, send `initialize`, `tools/list` and `tools/call` with curl and with Node fetch.
- Expected: responses arrive as the server wrote them.
- Actual: with Norton running, any response that leaves the server with a `Content-Length` arrives with that header replaced by `transfer-encoding: chunked` while the body stays unchunked, so every HTTP client rejects it (`HPE_INVALID_CHUNK_SIZE` in Node, `ERR_INVALID_CHUNKED_ENCODING` in Chrome). The MCP SDK buffers any reply that is ready at once (`tools/list`, `resources/read`, `ping`) and sends it with a length; `tools/call`, which awaits work, streams chunked and passes. That is why it first looked like a path or method rule. The server writes valid responses (checked with `res._header`); the same calls work over an in-memory transport.
- Severity: high on this machine. Every MCP client, Chrome included, failed `tools/list` and the MCP Apps `resources/read`.
- Workaround: the server strips `Content-Length` from MCP responses so Node sends them chunked, and writes its JSON errors chunked. With that, `tools/list` and `resources/read` pass over HTTP on `/mcp` with Norton still running. `MCP_PATH` stays configurable. The sim still times out `tools/list` after 8 seconds and shows a warning if a listing fails.
- Suggestion (for MCP builders): if a local MCP server fails with `HPE_INVALID_CHUNK_SIZE` or `ERR_INVALID_CHUNKED_ENCODING` on small fast replies only, check for security software that inspects loopback HTTP, and try sending the replies chunked.
- Suggestion (for the MCP SDK): an option to stream every response instead of buffering short ones would avoid this class of middlebox bug.

## 5. Keeping MCP sessions on a serverless host (23 Oct 2026)

- Task: host the demo so judges can use it without installing anything.
- Steps: deployed the Next.js host to Vercel; looked at where the Streamable HTTP server could run.
- Expected: run the MCP server as a serverless function next to the web app.
- Actual: Streamable HTTP keeps a transport per session in memory (`Mcp-Session-Id`), and the elicitation round trip (`elicitation/create` on the same POST stream) needs that session to stay on one process. A serverless function cannot promise that, so the "which Priya?" question would break between invocations.
- Severity: medium for anyone hosting an MCP server with elicitation on serverless.
- Workaround: the hosted demo runs the same server code inside the browser tab over `InMemoryTransport` pairs (`apps/mcp-server/src/in-tab.ts`), with the card HTML generated into a module so the server needs no file access. Streamable HTTP is used locally and in the integration tests.
- Suggestion (for the MCP SDK docs): a page on stateless versus stateful Streamable HTTP deployments that says which features (elicitation, server-initiated requests) need a sticky process.

## 6. Recording the demo video with Playwright on Windows (23 Oct 2026)

- Task: record the golden path in real Chrome for the demo video.
- Steps: `browser.newContext({ recordVideo })`.
- Expected: a video file, since ffmpeg 8.1 was already installed.
- Actual: Playwright wants its own ffmpeg download (`npx playwright install ffmpeg`); the system ffmpeg is ignored.
- Severity: low.
- Workaround: capture frames through Chrome's `Page.startScreencast` over CDP with their timestamps, write an ffmpeg concat list, and mux with the installed ffmpeg (`video/record.mjs`, `video/mux.mjs`). Frames arrive only when the picture changes, so the list carries each frame's real duration.
- Suggestion: let `recordVideo` take a path to an existing ffmpeg.

## 7. Vercel build of an npm workspace from Windows (23 Oct 2026)

- Task: `vercel build` locally, then deploy prebuilt output.
- Steps: ran `vercel build --prod` from the repo root with `rootDirectory` set to `apps/web`.
- Expected: a `.vercel/output` folder.
- Actual: the build creates symlinks between function folders (`_global-error.rsc.func`), which fails with `EPERM` on Windows without Developer Mode. Building on Vercel instead failed twice: the workspace install skipped the root dev dependencies (`@types/node` missing for the web app), and `next build` type-checked the test files that import the Express server.
- Severity: medium; about forty minutes lost the night before the deadline.
- Workaround: build on Vercel; declare `@types/node` in `apps/web`; point `next.config.ts` at a `tsconfig.build.json` that excludes `test/` and `scripts/`.
- Suggestion (for Vercel): say that local builds need symlink rights on Windows; install root dev dependencies for workspace builds. (For Next.js): a documented way to type-check only the files that ship.

## 3. MCP Apps package and SDK majors (21 Oct 2026)

- Task: add the MCP Apps card with `@modelcontextprotocol/ext-apps`.
- Steps: `npm view @modelcontextprotocol/ext-apps@2.0.3 peerDependencies`.
- Expected: the latest ext-apps works with the SDK that implements the protocol the hackathon names (2025-11-25, SDK v1.x).
- Actual: ext-apps 2.x needs the SDK v2 packages (`@modelcontextprotocol/server`, `client`, `core`), which implement 2026-07-28. ext-apps 1.7.5 is the last release for SDK v1.
- Severity: medium. The wrong pair fails at install or at runtime.
- Workaround: pin `@modelcontextprotocol/sdk` 1.32.1 and `@modelcontextprotocol/ext-apps` 1.7.5.
- Suggestion: say which SDK major the hackathon expects, and note the SDK pairing in the ext-apps README.
