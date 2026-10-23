// Full-screen text cards for the demo video. Plain type, product colours, no logos.
const base = `
  body { margin: 0; height: 100vh; display: grid; place-items: center; background: #1e1b1a; color: #f6f1ea;
    font-family: Georgia, serif; }
  main { max-width: 1200px; padding: 0 80px; }
  h1 { font-size: 96px; margin: 0; line-height: 1.05; }
  p { font: 34px/1.45 "Segoe UI", system-ui, sans-serif; color: #e9c7b3; margin: 28px 0 0; }
  small { display: block; font: 24px "Segoe UI", system-ui, sans-serif; color: #cfc6bd; margin-top: 40px; }
  li { font: 34px/1.6 "Segoe UI", system-ui, sans-serif; }
  b { color: #f0a37f; }`;

const page = (body) => `<!doctype html><html><head><style>${base}</style></head><body><main>${body}</main></body></html>`;

export const CARDS = {
  title: page(`<h1>Formula Book</h1><p>Say the formula at the bowl. Hear it back, scaled, next visit.</p>
    <small>MCP server, spec 2025-11-25 &middot; demo on a labelled simulated Alexa+ client &middot; demo data</small>`),
  prior: page(`<h1 style="font-size:64px">Prior art</h1><ul>
    <li><b>A colour brand's voice skill (2019)</b>: product questions by voice</li>
    <li><b>Formula apps</b>: scale, photo, per-client formulas, typed</li>
    <li><b>Salon software</b>: stores formulas per client, typed</li>
    <li><b>Formula Book</b>: capture and scale by voice at the bowl, any scale</li></ul>
    <small>Not tested on a real Alexa+ device.</small>`),
  end: page(`<h1>Formula Book</h1><p>github.com/let-the-dreamers-rise/formula-book</p><small>MIT licence &middot; Amazon Developer Hackathon 2026, Alexa+ track</small>`),
};
