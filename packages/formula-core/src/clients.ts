export type ClientMatch =
  | { readonly kind: "found"; readonly name: string }
  | { readonly kind: "ambiguous"; readonly options: readonly string[] }
  | { readonly kind: "not_found" };

export function foldName(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Exact full name first; otherwise any client whose first name or surname is the query. */
export function resolveClient(query: string, names: readonly string[]): ClientMatch {
  const wanted = foldName(query);
  if (!wanted) return { kind: "not_found" };
  const exact = names.find((name) => foldName(name) === wanted);
  if (exact) return { kind: "found", name: exact };
  const partial = names.filter((name) => foldName(name).split(" ").includes(wanted));
  if (partial.length === 1) return { kind: "found", name: partial[0] as string };
  if (partial.length > 1) return { kind: "ambiguous", options: partial };
  return { kind: "not_found" };
}
