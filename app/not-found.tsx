import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center" style={{ background: "#0c0b18" }}>

      <h1
        className="select-none"
        style={{
          fontSize: 160,
          fontWeight: 900,
          letterSpacing: "-0.04em",
          lineHeight: 1,
          background: "linear-gradient(135deg, #7c6ff7 0%, #a78bfa 50%, #10d49a 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          opacity: 0.25,
        }}
      >
        404
      </h1>

      <div style={{ marginTop: -40, position: "relative", zIndex: 10 }}>
        <h2 style={{ fontSize: 36, fontWeight: 800, color: "#f0eeff", marginBottom: 12 }}>Lost in Space</h2>
        <p style={{ fontSize: 18, color: "#8a87b0", maxWidth: 360, lineHeight: 1.6, marginBottom: 40 }}>
          We couldn&apos;t find the page you&apos;re looking for. It might have been moved or deleted.
        </p>
        <Link href="/">
          <button
            className="font-semibold transition-transform active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg, #7c6ff7, #5c55f0)", color: "#fff", fontSize: 18, borderRadius: 14, padding: "16px 40px", border: "none", boxShadow: "0 4px 20px rgba(124,111,247,0.30)", cursor: "pointer" }}
          >
            Return Home
          </button>
        </Link>
      </div>

    </div>
  );
}
