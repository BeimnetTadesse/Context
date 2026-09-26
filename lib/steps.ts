// The seven-step method. The order is the point: interpretation sixth, reflection last.
export const STEPS = [
  { key: "read", numeral: "I", name: "Read", tagline: "The text, slowly." },
  { key: "observe", numeral: "II", name: "Observe", tagline: "What’s on the page." },
  { key: "context", numeral: "III", name: "Context", tagline: "Who, when, and why." },
  { key: "language", numeral: "IV", name: "Language", tagline: "Words that carry weight." },
  { key: "connections", numeral: "V", name: "Connections", tagline: "Where else this appears." },
  { key: "interpretations", numeral: "VI", name: "Interpretations", tagline: "Where readers differ." },
  { key: "reflect", numeral: "VII", name: "Reflect", tagline: "What you bring." },
] as const;

export type StepKey = (typeof STEPS)[number]["key"];
export const isStepKey = (s: unknown): s is StepKey => STEPS.some((x) => x.key === s);
