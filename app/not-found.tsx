import Link from "next/link";
import { Button } from "@/modules/shared/components/Button";
import { Navbar } from "@/modules/shared/components/Navbar";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col bg-background-primary text-text-primary">
      <Navbar />

      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-[120px] font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-brand-core to-brand-vibrant opacity-20 select-none">
          404
        </h1>

        <div className="space-y-4 -mt-12 relative z-10">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Lost in Space
          </h2>
          <p className="text-text-secondary max-w-md mx-auto">
            We couldn&apos;t find the page you&apos;re looking for. It might
            have been moved or deleted.
          </p>

          <div className="pt-8">
            <Link href="/">
              <Button size="lg" className="w-full sm:w-auto">
                Return Home
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
