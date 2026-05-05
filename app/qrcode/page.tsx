"use client";

import QRCode from "react-qr-code";

export default function QrCodePage() {
  const code = "facebook.com";

  return (
    <main className="min-h-screen bg-background-primary text-text-primary flex items-center justify-center px-6">
      <section className="w-full max-w-md rounded-2xl glass p-8 text-center">
        <h1 className="text-3xl font-bold mb-3">Your QR Code</h1>
        <p className="text-text-secondary mb-6">
          Scan this QR code to continue logging in to your device:
        </p>
        <div className="bg-white p-4 rounded-xl inline-block">
          <QRCode value={code} size={220} />
        </div>
      </section>
    </main>
  );
}
