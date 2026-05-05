"use client";

import React from "react";
import { cn } from "@/modules/shared/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

export const Button = ({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) => {
  const baseStyles =
    "inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none";

  const variants = {
    primary:
      "bg-brand-vibrant text-white shadow-[0_0_20px_rgba(211,66,123,0.3)] hover:shadow-[0_0_30px_rgba(211,66,123,0.5)] hover:-translate-y-0.5",
    secondary:
      "bg-background-tertiary text-text-primary hover:bg-background-elevated",
    ghost:
      "bg-transparent text-text-secondary hover:bg-background-tertiary hover:text-text-primary",
    outline:
      "bg-transparent border border-border-default text-text-primary hover:border-brand-vibrant hover:text-brand-vibrant",
  };

  const sizes = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-lg",
  };

  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </button>
  );
};
