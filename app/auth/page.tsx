"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import { Eye, EyeOff, Lock, Mail, Moon, Sun, ArrowRight, Sparkles } from "lucide-react";
import { RouteGuard } from "@/modules/shared/components/RouteGuard";
import { useAuthStore } from "@/modules/shared/store/useAuthStore";
import { AuthLayout } from "@/modules/shared/components/AuthLayout";
import { AuthCard } from "@/modules/shared/components/AuthCard";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);

  const { login, isLoading, isAuthenticated } = useAuthStore();
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, router]);

  const isDarkMode = mounted ? resolvedTheme === "dark" : true;
  const toggleTheme = () => setTheme(isDarkMode ? "light" : "dark");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
      router.replace("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid credentials");
    }
  };

  if (!mounted) return null;

  return (
    <RouteGuard requireAuth={false}>
      <AuthLayout headline={["Welcome", "Back."]} tagline="Continue your journey with the most advanced boilerplate yet.">
        <AuthCard>
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="text-3xl font-black tracking-tight mb-2">Sign In</h2>
              <p className="text-sm text-text-tertiary font-medium">Enter your credentials to access your account</p>
            </div>
            <button
              onClick={toggleTheme}
              className="p-3 rounded-2xl glass-light hover:bg-white/10 transition-all border border-white/5"
            >
              {isDarkMode ? <Sun className="w-5 h-5 text-brand-light" /> : <Moon className="w-5 h-5 text-brand-core" />}
            </button>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
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
              <div className="flex items-center justify-between ml-1">
                <label className="text-xs font-black uppercase tracking-widest text-text-quaternary">Password</label>
                <button
                  type="button"
                  onClick={() => router.push("/forgot-password")}
                  className="text-xs font-bold text-brand-light hover:text-brand-vibrant transition-colors"
                >
                  Forgot?
                </button>
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-quaternary group-focus-within:text-brand-light transition-colors z-10" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
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

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-14 bg-gradient-to-r from-brand-core to-brand-vibrant text-white font-black rounded-2xl glow-vibrant hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 group shadow-xl"
            >
              {isLoading ? "Verifying..." : "Continue to Dashboard"}
              {!isLoading && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
            </button>

            <div className="text-center pt-4">
              <p className="text-sm text-text-tertiary font-medium">
                New here?{" "}
                <button
                  type="button"
                  onClick={() => router.push("/register")}
                  className="text-brand-light hover:text-brand-vibrant font-black transition-colors"
                >
                  Create an account
                </button>
              </p>
            </div>
          </form>
        </AuthCard>
      </AuthLayout>
    </RouteGuard>
  );
}
