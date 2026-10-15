// Single source of truth for the label color palette. `value` is what the API
// stores (free-form string), `key` is the i18n key under
// `common:modals.createTask.labelColors.*`.
const labelColors = [
  {
    value: "gray",
    key: "stone",
    color: "var(--color-stone-500)",
    label: "Stone",
  },
  {
    value: "dark-gray",
    key: "slate",
    color: "var(--color-slate-500)",
    label: "Slate",
  },
  {
    value: "purple",
    key: "lavender",
    color: "var(--color-violet-500)",
    label: "Lavender",
  },
  {
    value: "teal",
    key: "sage",
    color: "var(--color-emerald-600)",
    label: "Sage",
  },
  {
    value: "green",
    key: "forest",
    color: "var(--color-green-600)",
    label: "Forest",
  },
  {
    value: "yellow",
    key: "amber",
    color: "var(--color-amber-600)",
    label: "Amber",
  },
  {
    value: "orange",
    key: "terracotta",
    color: "var(--color-orange-600)",
    label: "Terracotta",
  },
  { value: "pink", key: "rose", color: "var(--color-rose-600)", label: "Rose" },
  {
    value: "red",
    key: "crimson",
    color: "var(--color-red-600)",
    label: "Crimson",
  },
  { value: "sky", key: "sky", color: "var(--color-sky-500)", label: "Sky" },
  {
    value: "blue",
    key: "ocean",
    color: "var(--color-blue-600)",
    label: "Ocean",
  },
  { value: "cyan", key: "cyan", color: "var(--color-cyan-500)", label: "Cyan" },
  {
    value: "indigo",
    key: "indigo",
    color: "var(--color-indigo-500)",
    label: "Indigo",
  },
  {
    value: "fuchsia",
    key: "fuchsia",
    color: "var(--color-fuchsia-500)",
    label: "Fuchsia",
  },
  { value: "lime", key: "lime", color: "var(--color-lime-600)", label: "Lime" },
  {
    value: "emerald",
    key: "emerald",
    color: "var(--color-emerald-500)",
    label: "Emerald",
  },
] as const satisfies ReadonlyArray<{
  value: string;
  key: string;
  color: string;
  label: string;
}>;

export type LabelColorValue = (typeof labelColors)[number]["value"];

export default labelColors;
