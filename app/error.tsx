"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route Error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8" style={{ background: "#0c0b18" }}>
      <div
        className="max-w-md w-full text-center p-10 flex flex-col items-center gap-6"
        style={{ background: "#141230", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 24 }}
      >
        <div
          className="flex items-center justify-center"
          style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.25)" }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: "#f0eeff", marginBottom: 8 }}>Something went wrong</h2>
          <p style={{ fontSize: 16, color: "#8a87b0", lineHeight: 1.6 }}>An unexpected error occurred. Please try again.</p>
        </div>
        <button
          onClick={reset}
          className="w-full font-semibold transition-transform active:scale-[0.98]"
          style={{ background: "linear-gradient(135deg, #7c6ff7, #5c55f0)", color: "#fff", fontSize: 18, borderRadius: 14, padding: "16px 0", border: "none", boxShadow: "0 4px 20px rgba(124,111,247,0.30)", cursor: "pointer" }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
