"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Mail, Send } from "lucide-react";
import { AuthLayout } from "@/modules/shared/components/AuthLayout";
import { AuthCard } from "@/modules/shared/components/AuthCard";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <AuthLayout headline={["Forgot your", "password?"]} tagline="Don't worry, we'll help you get back to building in no time.">
      <AuthCard>
        <button
          type="button"
          onClick={() => router.push("/auth")}
          className="flex items-center gap-2 text-text-tertiary hover:text-brand-light transition-colors mb-8 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-bold">Back to Login</span>
        </button>

        <div className="mb-10 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-brand-core to-brand-vibrant rounded-3xl flex items-center justify-center mb-8 mx-auto glow-vibrant animate-float">
            <Mail className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-3xl font-black tracking-tight mb-3">
            Reset Password
          </h2>
          <p className="text-sm text-text-tertiary font-medium max-w-[280px] mx-auto leading-relaxed">
            Enter your email address and we&apos;ll send you a secure link to reset your password.
          </p>
        </div>

        {submitted ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-8"
          >
            <div className="p-6 rounded-3xl glass-light border border-white/5 text-sm text-text-secondary leading-relaxed font-medium">
              If an account exists for{" "}
              <span className="font-bold text-brand-light underline decoration-brand-light/30 underline-offset-4">{email}</span>,
              you&apos;ll receive a reset link shortly. Please check your spam folder if you don&apos;t see it.
            </div>
            <button
              type="button"
              onClick={() => router.push("/auth")}
              className="w-full h-14 bg-gradient-to-r from-brand-core to-brand-vibrant text-white font-black rounded-2xl glow-vibrant hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              Return to Sign In
            </button>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
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

            <button
              type="submit"
              className="w-full h-14 bg-gradient-to-r from-brand-core to-brand-vibrant text-white font-black rounded-2xl glow-vibrant hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 group shadow-xl"
            >
              Send Reset Link
              <Send className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
            </button>
          </form>
        )}
      </AuthCard>
    </AuthLayout>
  );
}
