import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};
import { Geist, Geist_Mono, Poppins } from "next/font/google";
import "./globals.css";
import "./mirror-theme.css";
import { AuthInitializer } from "@/components/AuthInitializer";
import { ThemeProvider } from "@/modules/shared/components/ThemeProvider";
import { QueryProvider } from "@/modules/shared/providers/QueryProvider";
import { VoiceProvider } from "@/modules/shared/voice/VoiceProvider";
import GlobalVoiceOverlay from "@/components/GlobalVoiceOverlay";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    template: "%s | Mirror App",
    default: "Mirror App",
  },
  description:
    "Mirror App is a Next.js app with authentication, QR code flow, and shared UI modules.",
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL
    ? new URL(process.env.NEXT_PUBLIC_SITE_URL)
    : undefined,
  openGraph: {
    title: "Mirror App",
    description:
      "Mirror App is a Next.js app with authentication, QR code flow, and shared UI modules.",
    url: process.env.NEXT_PUBLIC_SITE_URL,
    siteName: "Mirror App",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mirror App",
    description:
      "Mirror App is a Next.js app with authentication, QR code flow, and shared UI modules.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${poppins.variable} ${geistSans.variable} ${geistMono.variable} font-sans antialiased bg-background-primary text-text-primary`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <VoiceProvider>
              <AuthInitializer>{children}</AuthInitializer>
              <GlobalVoiceOverlay />
            </VoiceProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
