import Link from "next/link";

const STEPS = [
  { say: "Lena's last formula", get: "40 g 5N, 10 g 6.3, 50 g of 20 volume, 1 to 1, 35 minutes. Total 100 g." },
  { say: "Make it one and a half times", get: "60 g 5N, 15 g 6.3, developer 75 g. Total 150 g." },
  { say: "Colour Marta: 30 grams 6N and 20 grams 7.1, 20 volume, one to one and a half", get: "Saved. Developer 75 g. Total 125 g." },
] as const;

const ROWS = [
  ["Before", "A card in a drawer, a note on a phone, or memory. Typed later, with colour on the gloves."],
  ["With Formula Book", "Said at the bowl, saved to the client, read back next visit and scaled to today's bowl."],
] as const;

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-4 pb-20">
      <header className="flex items-center justify-between py-6">
        <p className="font-[Georgia,serif] text-2xl font-semibold">Formula Book</p>
        <a href="https://github.com/let-the-dreamers-rise/formula-book" className="rounded px-3 py-2 underline-offset-4 hover:underline">
          Source on GitHub
        </a>
      </header>

      <section className="grid items-center gap-10 py-10 md:grid-cols-2">
        <div className="rise">
          <h1 className="font-[Georgia,serif] text-4xl leading-tight font-semibold md:text-5xl">Say the formula at the bowl. Hear it back next visit.</h1>
          <p className="mt-5 text-lg text-black/75">
            For hair colourists with gloves on. Formula Book saves each client&apos;s colour formula by voice, reads it back and scales it to
            today&apos;s bowl. Any scale, no extra hardware.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/sim" className="min-h-11 rounded bg-[var(--copper)] px-5 py-3 text-white transition-transform hover:-translate-y-0.5">
              Try the simulated Alexa+ demo
            </Link>
            <a href="#how" className="min-h-11 rounded border border-[var(--ink)] px-5 py-3 transition-transform hover:-translate-y-0.5">
              How it works
            </a>
          </div>
          <p className="mt-4 text-sm text-black/60">Demo uses a labelled simulated Alexa+ client and demo data. Not tested on a real Alexa+ device.</p>
        </div>
        <ol aria-label="Example conversation" className="flex flex-col gap-3 rounded-2xl bg-[var(--ink)] p-5 text-[var(--paper)] shadow-xl">
          {STEPS.map((step, i) => (
            <li key={step.say} className="rise flex flex-col gap-2" style={{ animationDelay: `${150 + i * 160}ms` }}>
              <span className="self-end rounded-lg bg-[var(--lcd)] px-3 py-2 text-sm text-[var(--ink)]">&ldquo;{step.say}&rdquo;</span>
              <span className="rounded-lg bg-white/10 px-3 py-2 text-sm">{step.get}</span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-label="Before and after" className="grid gap-4 py-8 md:grid-cols-2">
        {ROWS.map(([title, text], i) => (
          <div key={title} className={`rounded-xl p-6 ${i === 0 ? "bg-white" : "bg-[var(--lcd)]"}`}>
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-2 text-black/75">{text}</p>
          </div>
        ))}
      </section>

      <section id="how" className="py-10">
        <h2 className="font-[Georgia,serif] text-3xl font-semibold">How it works</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <article className="rounded-xl bg-white p-6">
            <h3 className="font-semibold">An MCP server is the product</h3>
            <p className="mt-2 text-black/75">Three tools over Streamable HTTP, spec 2025-11-25: get, scale and save a formula. The maths and the memory live on the server.</p>
          </article>
          <article className="rounded-xl bg-white p-6">
            <h3 className="font-semibold">It asks, never guesses</h3>
            <p className="mt-2 text-black/75">Two clients called Priya? The server asks which one through MCP elicitation. An unknown client gets a plain refusal and the next step.</p>
          </article>
          <article className="rounded-xl bg-white p-6">
            <h3 className="font-semibold">One result, three surfaces</h3>
            <p className="mt-2 text-black/75">An MCP Apps card on a screen, the same card reflowed on a phone, one spoken sentence on a speaker.</p>
          </article>
        </div>
      </section>

      <section className="rounded-2xl bg-[var(--ink)] p-8 text-[var(--paper)]">
        <h2 className="font-[Georgia,serif] text-3xl font-semibold">Free for your first 50 formulas.</h2>
        <p className="mt-3 text-white/75">The paid plan price is a hypothesis and payments are not live. The server enforces the free limit today.</p>
        <Link href="/sim" className="mt-6 inline-block min-h-11 rounded bg-[var(--copper)] px-5 py-3 text-white transition-transform hover:-translate-y-0.5">
          Open the demo
        </Link>
      </section>

      <footer className="mt-10 flex flex-wrap justify-between gap-2 text-sm text-black/60">
        <span>Formula Book. MIT licence.</span>
        <span>Built for the Amazon Developer Hackathon 2026, Alexa+ track.</span>
      </footer>
    </main>
  );
}
