import type { VersionCode } from "@/lib/versions";

/** Underline key phrases by provenance label. Only on WEB, whose wording the underlines are anchored to. */
export function ProvenanceToggle({
  on,
  onToggle,
  hasLetters,
  primary,
  greek,
}: {
  on: boolean;
  onToggle: () => void;
  hasLetters: boolean;
  primary: VersionCode;
  greek: boolean;
}) {
  const layerAvailable = hasLetters && primary === "WEB" && !greek;
  const layerOn = on && layerAvailable;
  return (
    <button
      onClick={onToggle}
      disabled={!layerAvailable}
      role="switch"
      aria-checked={layerOn}
      className="flex items-center gap-3 text-sm disabled:cursor-not-allowed disabled:text-muted"
      title={!hasLetters ? "Appears once this chapter's study is prepared" : primary !== "WEB" ? "Underlines follow the WEB wording — choose WEB as your main version" : "Underline key phrases by provenance label"}
    >
      <span className={`relative h-6 w-11 rounded-full transition ${layerOn ? "bg-ink" : "bg-rule"}`}>
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-card transition-all ${layerOn ? "left-6" : "left-1"}`} />
      </span>
      Provenance layer
    </button>
  );
}
