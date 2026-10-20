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
- Actual: with Norton running, (a) any response on a path containing "mcp" gets a `transfer-encoding: chunked` header injected while the body stays unchunked, so every HTTP client rejects it; (b) on another path, `tools/list` responses still arrive de-chunked under a chunked header, and fixed-length JSON errors to requests carrying `Mcp-Session-Id` are corrupted the same way. `tools/call` responses pass. The server writes valid responses (checked with `res._header`); the same calls work over an in-memory transport.
- Severity: high on this machine. Every MCP client, Chrome included, fails `tools/list`.
- Workaround: `MCP_PATH` setting (default `/mcp`), chunked JSON error bodies, and `tools/list` tested in memory. The browser path needs the security software to leave loopback traffic alone.
- Suggestion (for MCP builders): if a local MCP server fails with `HPE_INVALID_CHUNK_SIZE` or `ERR_INVALID_CHUNKED_ENCODING`, check for security software that inspects loopback HTTP before debugging the server.

## 3. MCP Apps package and SDK majors (21 Oct 2026)

- Task: add the MCP Apps card with `@modelcontextprotocol/ext-apps`.
- Steps: `npm view @modelcontextprotocol/ext-apps@2.0.3 peerDependencies`.
- Expected: the latest ext-apps works with the SDK that implements the protocol the hackathon names (2025-11-25, SDK v1.x).
- Actual: ext-apps 2.x needs the SDK v2 packages (`@modelcontextprotocol/server`, `client`, `core`), which implement 2026-07-28. ext-apps 1.7.5 is the last release for SDK v1.
- Severity: medium. The wrong pair fails at install or at runtime.
- Workaround: pin `@modelcontextprotocol/sdk` 1.32.1 and `@modelcontextprotocol/ext-apps` 1.7.5.
- Suggestion: say which SDK major the hackathon expects, and note the SDK pairing in the ext-apps README.
