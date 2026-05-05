"use client";

import { useEffect } from "react";
import { Button } from "@/modules/shared/components/Button";
import { Card } from "@/modules/shared/components/Card";
import { Navbar } from "@/modules/shared/components/Navbar";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Optionally log the error to an error reporting service like Sentry
    console.error("Route Error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background-primary text-text-primary flex flex-col items-center justify-center p-4">
      <Navbar />
      <Card
        variant="glass"
        className="max-w-md w-full p-8 text-center space-y-6"
      >
        <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
          </svg>
        </div>
        <h2 className="text-2xl font-bold tracking-tight">
          Something went wrong
        </h2>
        <p className="text-text-secondary text-sm">
          We&apos;ve encountered an unexpected error. Please try again.
        </p>
        <Button onClick={() => reset()} className="w-full">
          Try again
        </Button>
      </Card>
    </div>
  );
}
