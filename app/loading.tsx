export default function Loading() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-5"
      style={{ background: "#0c0b18" }}
    >
      <div
        className="animate-spin"
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          border: "3px solid rgba(124,111,247,0.15)",
          borderTopColor: "#7c6ff7",
        }}
      />
      <p style={{ fontSize: 16, color: "#4a4870", fontWeight: 500 }}>Loading…</p>
    </div>
  );
}
