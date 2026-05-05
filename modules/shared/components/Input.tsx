"use client";

import React from "react";
import { cn } from "@/modules/shared/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full border border-border-default bg-background-secondary px-4 py-3 text-sm text-text-primary placeholder:text-text-tertiary outline-none transition-colors focus:border-brand-vibrant focus:ring-2 focus:ring-brand-vibrant/20",
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";
