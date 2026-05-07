"use client";

import { useSearchParams } from "next/navigation";

export default function KioskLoggedInPage() {
  const searchParams = useSearchParams();
  const username = searchParams.get("username") || "User";

  return (
    <main className="min-h-screen bg-background-primary text-text-primary flex items-center justify-center px-6">
      <section className="w-full max-w-md rounded-2xl glass p-8 text-center">
        <h1 className="text-3xl font-bold mb-3">Login Successful</h1>
        <p className="text-text-secondary mb-2">Signed in user:</p>
        <p className="text-xl font-semibold break-all">{username}</p>
      </section>
    </main>
  );
}

