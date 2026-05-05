"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Mail, ShieldCheck, Zap } from "lucide-react";
import { AuthLayout } from "@/modules/shared/components/AuthLayout";
import { AuthCard } from "@/modules/shared/components/AuthCard";

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "your email";

  const OTP_LENGTH = 6;
  const [otp, setOtp] = useState(Array.from({ length: OTP_LENGTH }, () => ""));
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [timer, setTimer] = useState(147);
  const [canResend, setCanResend] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (timer > 0) {
      const timeout = window.setTimeout(() => setTimer((t) => t - 1), 1000);
      return () => window.clearTimeout(timeout);
    }
    setCanResend(true);
  }, [timer]);

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return;
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.join("").length === OTP_LENGTH) {
      // For boilerplate, redirect to root or landing
      router.push("/");
    }
  };

  const handleResend = () => {
    if (!canResend) return;
    setTimer(147);
    setCanResend(false);
    setOtp(Array.from({ length: OTP_LENGTH }, () => ""));
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const paste = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    const next = [...otp];
    paste.split("").forEach((ch, i) => {
      next[i] = ch;
    });
    setOtp(next);
    const idx = Math.min(paste.length, OTP_LENGTH - 1);
    inputRefs.current[idx]?.focus();
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  if (!mounted) return null;

  return (
    <AuthLayout headline={["One last", "step."]} tagline="Protecting your account is our top priority. Verify your email to continue.">
      <AuthCard>
        <button
          type="button"
          onClick={() => router.push(`/register?email=${encodeURIComponent(email)}`)}
          className="flex items-center gap-2 text-text-tertiary hover:text-brand-light transition-colors mb-8 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-bold">Back</span>
        </button>

        <div className="mb-10 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-brand-core to-brand-vibrant rounded-3xl flex items-center justify-center mb-8 mx-auto glow-vibrant animate-float">
            <ShieldCheck className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-3xl font-black tracking-tight mb-3">Verify Email</h2>
          <p className="text-sm text-text-tertiary font-medium max-w-[280px] mx-auto leading-relaxed">
            We&apos;ve sent a security code to <span className="text-brand-light font-bold">{email}</span>.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="flex gap-2 sm:gap-4 justify-center" onPaste={handlePaste}>
            {otp.map((digit, index) => (
              <input
                key={`otp-${index}`}
                type="text"
                inputMode="numeric"
                value={digit}
                onChange={(e) => handleOtpChange(index, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(index, e)}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                className="w-12 h-14 text-center text-2xl font-black rounded-2xl glass-light border border-white/5 focus:border-brand-core/50 focus:ring-4 focus:ring-brand-core/10 transition-all outline-none"
                maxLength={1}
              />
            ))}
          </div>

          <button
            type="submit"
            disabled={otp.join("").length !== OTP_LENGTH}
            className="w-full h-14 bg-gradient-to-r from-brand-core to-brand-vibrant text-white font-black rounded-2xl glow-vibrant hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 group shadow-xl"
          >
            Complete Verification
            <Zap className="w-5 h-5 group-hover:scale-110 transition-transform" />
          </button>

          <div className="text-center">
            <p className="text-sm text-text-tertiary font-medium mb-4">
              Didn&apos;t receive the code?
            </p>
            <button
              type="button"
              onClick={handleResend}
              disabled={!canResend}
              className="px-6 py-2.5 rounded-xl glass-light text-brand-light hover:text-brand-vibrant font-black transition-all disabled:opacity-50"
            >
              {canResend ? "Resend Code" : `Resend in ${formatTime(timer)}`}
            </button>
          </div>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}
