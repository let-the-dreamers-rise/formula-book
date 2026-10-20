import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-semibold">Formula Book</h1>
      <p className="mt-4 text-lg">
        Hair colourists say a client&apos;s colour formula at the bowl and get it back, scaled, next visit.
      </p>
      <p className="mt-2">A self-hosted MCP server, driven here by a labelled simulated Alexa+ client.</p>
      <Link href="/sim" className="mt-8 inline-block rounded bg-[var(--copper)] px-5 py-3 text-white">
        Open the simulator
      </Link>
    </main>
  );
}
