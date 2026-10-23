# Product feedback

One entry per tool used in the build. Each says what worked, what did not, and what we would change.

## MCP TypeScript SDK 1.32.1

- Worked: `McpServer.registerTool` with zod schemas, Streamable HTTP sessions, `structuredContent`, and sending `elicitation/create` on the same POST stream with `relatedRequestId`.
- Did not: the negotiated protocol version is not stored on the server, so we read it from the `initialize` body to decide whether a session can elicit. Short replies are buffered and sent with a `Content-Length`, which local security software corrupted (friction log entry 4).
- Change: expose the negotiated version on the server session, and offer an option to stream every reply.

## MCP Apps (`@modelcontextprotocol/ext-apps` 1.7.5)

- Worked: `AppBridge` and `PostMessageTransport` on the host side took little code; `setHostContext` sends only the changed fields, so a device switch re-adapts the card without a new tool call.
- Did not: version 2.x needs SDK v2, which is not obvious from npm (friction log entry 3). The view bundle with dependencies is 337 KB, too large to inline, so the card speaks the protocol by hand.
- Change: a small dependency-free view helper for single-file cards.

## Alexa+ developer documentation

- Worked: the layout page (`deviceClass`, `maxWidth`, fallback advice) and the client lifecycle page (result shape with `_meta.ui`) were enough to copy the payload shape.
- Did not: the device-class list and the add-on tools are partner-only (friction log entry 1), so the values in this repo are a guess. The lifecycle page shows protocol 2025-03-26 while the hackathon asks for 2025-11-25 (entry 2).
- Change: publish the `deviceClass` values and a public simulator.

## Web Speech API (Chrome) and speechSynthesis

- Worked: one-shot recognition with no key; reading the server's sentence aloud.
- Did not: no accuracy data on shade codes such as "6N" or "7.1"; recognition may go through a network service.
- Change: a phrase-hint list for domain codes.

## Next.js 16 (Turbopack)

- Worked: fast dev reloads, `transpilePackages` for the shared workspace package.
- Did not: the dev server writes an `AGENTS.md` into the app unless `agentRules: false` is set.

## Playwright 1.64 with installed Chrome

- Worked: `frameLocator` assertions inside the sandboxed card iframe.
- Did not: a click straight after a scripted scroll sometimes landed in the out-of-process iframe because hit-testing was a frame old. Waiting two animation frames fixed it.

## Anthropic API (Claude Haiku 5.5 as the tool chooser)

- Worked: the MCP server's `tools/list` schemas went straight into the Messages API `tools` field; Haiku picked `scale_formula` with `factor: 2` for "go for twice the amount" and declined off-topic requests in one sentence. Feeding each round's results back as `tool_result` blocks let it read the diary server first and then call Formula Book once per booked client, with no extra prompting.
- Did not: MCP's `inputSchema` and the SDK's `input_schema` type differ slightly in TypeScript, so a cast was needed.
- Change: a helper in the SDK that takes an MCP tool list as-is.

## Vercel (hosting the host)

- Worked: `vercel deploy --prod` from the repo root with `rootDirectory` set, and sensitive environment variables for the Claude key.
- Did not: local `vercel build` needs symlink rights on Windows; workspace builds skipped root dev dependencies (friction log entry 7). No way to keep an MCP session on one process (entry 5), so the demo runs the server code in the tab.

## Claude Code and the Anthropic API

- Worked: research, spec, and most of the code were written with Claude under the builder's direction; tests were written before code for each milestone.
- Did not: long sessions needed context summaries; credit-limited runs meant some critique loops were fixed by hand.
