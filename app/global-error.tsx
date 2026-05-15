"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global Layout Error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ background: "#0c0b18", color: "#f0eeff", display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif", margin: 0 }}>
        <div style={{ textAlign: "center", padding: 40, maxWidth: 420, border: "1px solid rgba(248,113,113,0.20)", background: "rgba(248,113,113,0.06)", borderRadius: 24 }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Critical Application Error</h2>
          <p style={{ color: "#8a87b0", marginBottom: 28, fontSize: 15, lineHeight: 1.6 }}>
            A severe error occurred that prevented the application from loading. Please refresh the page.
          </p>
          <button
            onClick={() => reset()}
            style={{ padding: "14px 28px", background: "linear-gradient(135deg, #7c6ff7, #5c55f0)", color: "#fff", fontWeight: 600, fontSize: 16, borderRadius: 12, border: "none", cursor: "pointer", boxShadow: "0 4px 20px rgba(124,111,247,0.30)" }}
          >
            Refresh Application
          </button>
        </div>
      </body>
    </html>
  );
}
