"use client";

export default function WaitingLoginPage() {
  return (
    <main className="min-h-screen bg-background-primary text-text-primary flex items-center justify-center px-6">
      <section className="w-full max-w-md rounded-2xl glass p-8 text-center">
        <h1 className="text-3xl font-bold mb-3">Waiting to Login</h1>
        <p className="text-text-secondary mb-4">
          Your kiosk has been scanned. Please complete the login process on the
          other device.
        </p>
      </section>
    </main>
  );
}

