"use client";

interface CreateOutfitBarProps {
  /** Whether the bar shows at all (create mode, or an outfit was modified). */
  visible: boolean;
  /** Disabled in create mode until a top + bottom + shoes are chosen. */
  disabled: boolean;
  label: string;
  onCreate: () => void;
}

/** Centered call-to-action (placed just below the header) that opens the outfit
 *  preview/confirm modal. Renders nothing when not visible. */
export function CreateOutfitBar({
  visible,
  disabled,
  label,
  onCreate,
}: CreateOutfitBarProps) {
  if (!visible) return null;

  return (
    <div className="flex justify-center shrink-0 pt-2 pb-1 z-20">
      <button
        disabled={disabled}
        style={{
          padding: "12px 48px",
          background: disabled ? "rgba(255,255,255,0.25)" : "#ffffff",
          color: disabled ? "rgba(0,0,0,0.35)" : "#000",
          border: "none",
          borderRadius: "14px",
          fontSize: "16px",
          fontWeight: "700",
          cursor: disabled ? "not-allowed" : "pointer",
          letterSpacing: "0.4px",
          boxShadow: disabled ? "none" : "0 4px 24px rgba(0,0,0,0.4)",
          transition: "opacity 0.2s, transform 0.1s",
        }}
        onMouseEnter={(e) => {
          if (!disabled) e.currentTarget.style.opacity = "0.88";
        }}
        onMouseLeave={(e) => {
          if (!disabled) e.currentTarget.style.opacity = "1";
        }}
        onMouseDown={(e) => {
          if (!disabled) e.currentTarget.style.transform = "scale(0.97)";
        }}
        onMouseUp={(e) => {
          if (!disabled) e.currentTarget.style.transform = "scale(1)";
        }}
        onClick={() => {
          if (!disabled) onCreate();
        }}
      >
        {label}
      </button>
    </div>
  );
}
