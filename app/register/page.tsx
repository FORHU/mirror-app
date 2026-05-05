"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { User, Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft } from "lucide-react";
import { RouteGuard } from "@/modules/shared/components/RouteGuard";
import { useAuthStore } from "@/modules/shared/store/useAuthStore";
import { AuthLayout } from "@/modules/shared/components/AuthLayout";
import { AuthCard } from "@/modules/shared/components/AuthCard";

export default function RegisterPage() {
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get("email") ?? "";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [mounted, setMounted] = useState(false);

  const { register, isLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => setMounted(true), []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (!agreeTerms) {
        setError("Please accept the terms to continue.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }

      const derivedUsername = email.split("@")[0]?.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase().slice(0, 24) || "user";

      await register({
        email,
        username: derivedUsername,
        displayName: fullName,
        password,
      });

      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    }
  };

  if (!mounted) return null;

  return (
    <RouteGuard requireAuth={false}>
      <AuthLayout headline={["Start", "Building."]} tagline="Join the community and start building with the future in mind.">
        <AuthCard>
          <div className="mb-10">
            <h2 className="text-3xl font-black tracking-tight mb-2">Create Account</h2>
            <p className="text-sm text-text-tertiary font-medium">Join us and access premium boilerplate features</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-5">
            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-sm text-red-500 font-bold"
              >
                {error}
              </motion.div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-text-quaternary ml-1">Full Name</label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-quaternary group-focus-within:text-brand-light transition-colors z-10" />
                <input
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full h-14 pl-12 pr-4 rounded-2xl glass-light border border-white/5 focus:border-brand-core/50 focus:ring-4 focus:ring-brand-core/10 transition-all outline-none font-medium placeholder:text-text-quaternary"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-text-quaternary ml-1">Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-quaternary group-focus-within:text-brand-light transition-colors z-10" />
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-14 pl-12 pr-4 rounded-2xl glass-light border border-white/5 focus:border-brand-core/50 focus:ring-4 focus:ring-brand-core/10 transition-all outline-none font-medium placeholder:text-text-quaternary"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-text-quaternary ml-1">Password</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-quaternary group-focus-within:text-brand-light transition-colors z-10" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-14 pl-12 pr-12 rounded-2xl glass-light border border-white/5 focus:border-brand-core/50 focus:ring-4 focus:ring-brand-core/10 transition-all outline-none font-medium placeholder:text-text-quaternary"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-text-quaternary hover:text-brand-light transition-colors z-10"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-text-quaternary ml-1">Confirm Password</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-quaternary group-focus-within:text-brand-light transition-colors z-10" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full h-14 pl-12 pr-4 rounded-2xl glass-light border border-white/5 focus:border-brand-core/50 focus:ring-4 focus:ring-brand-core/10 transition-all outline-none font-medium placeholder:text-text-quaternary"
                  required
                />
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer select-none group/box py-2">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="peer h-5 w-5 rounded-lg border-2 border-white/10 bg-white/5 accent-brand-core transition-all"
                />
              </div>
              <span className="text-sm text-text-tertiary font-medium">
                I agree to the <span className="text-brand-light font-bold hover:text-brand-vibrant transition-colors">Terms</span> and <span className="text-brand-light font-bold hover:text-brand-vibrant transition-colors">Privacy Policy</span>
              </span>
            </label>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-14 bg-gradient-to-r from-brand-core to-brand-vibrant text-white font-black rounded-2xl glow-vibrant hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 group shadow-xl"
            >
              {isLoading ? "Creating..." : "Generate Account"}
              {!isLoading && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
            </button>

            <div className="text-center pt-4">
              <p className="text-sm text-text-tertiary font-medium">
                Already member?{" "}
                <button
                  type="button"
                  onClick={() => router.push("/auth")}
                  className="text-brand-light hover:text-brand-vibrant font-black transition-colors"
                >
                  Sign In
                </button>
              </p>
            </div>
          </form>
        </AuthCard>
      </AuthLayout>
    </RouteGuard>
  );
}
