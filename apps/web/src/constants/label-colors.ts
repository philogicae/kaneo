// Single source of truth for the label color palette. `value` is what the API
// stores (free-form string), `key` is the i18n key under
// `common:modals.createTask.labelColors.*`.
const labelColors = [
  { value: "gray", key: "stone", color: "var(--color-stone-500)" },
  { value: "dark-gray", key: "slate", color: "var(--color-slate-500)" },
  { value: "purple", key: "lavender", color: "var(--color-violet-500)" },
  { value: "teal", key: "sage", color: "var(--color-emerald-600)" },
  { value: "green", key: "forest", color: "var(--color-green-600)" },
  { value: "yellow", key: "amber", color: "var(--color-amber-600)" },
  { value: "orange", key: "terracotta", color: "var(--color-orange-600)" },
  { value: "pink", key: "rose", color: "var(--color-rose-600)" },
  { value: "red", key: "crimson", color: "var(--color-red-600)" },
  { value: "sky", key: "sky", color: "var(--color-sky-500)" },
  { value: "blue", key: "ocean", color: "var(--color-blue-600)" },
  { value: "cyan", key: "cyan", color: "var(--color-cyan-500)" },
  { value: "indigo", key: "indigo", color: "var(--color-indigo-500)" },
  { value: "fuchsia", key: "fuchsia", color: "var(--color-fuchsia-500)" },
  { value: "lime", key: "lime", color: "var(--color-lime-600)" },
  { value: "emerald", key: "emerald", color: "var(--color-emerald-500)" },
] as const satisfies ReadonlyArray<{
  value: string;
  key: string;
  color: string;
}>;

export type LabelColorValue = (typeof labelColors)[number]["value"];

export default labelColors;
