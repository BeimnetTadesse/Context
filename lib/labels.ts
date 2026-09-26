// The six provenance labels — one vocabulary shared by the database enum, the UI and the AI.
export const LABELS = ["explicit", "inference", "historical", "scholarly", "tradition", "personal"] as const;
export type Label = (typeof LABELS)[number];

export const LABEL_INFO: Record<Label, { name: string; short: string; meaning: string }> = {
  explicit: { name: "Explicit in the text", short: "Explicit", meaning: "The words are on the page." },
  inference: { name: "Strong inference", short: "Inference", meaning: "Follows closely from the text." },
  historical: { name: "Historical evidence", short: "Historical", meaning: "From manuscripts, lexicons, or ancient sources." },
  scholarly: { name: "Scholarly interpretation", short: "Scholarly", meaning: "A reasoned reading others dispute." },
  tradition: { name: "Tradition", short: "Tradition", meaning: "Handed down in the church, not derived from the passage." },
  personal: { name: "Personal reflection", short: "Personal", meaning: "What the passage raises for you." },
};

export const labelColor = (l: Label) => `var(--l-${l})`;
export const labelBg = (l: Label) => `var(--l-${l}-bg)`;
