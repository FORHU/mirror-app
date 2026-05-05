"use client";

import React, { InputHTMLAttributes } from "react";
import { cn } from "@/modules/shared/utils";

export interface SearchBarProps extends InputHTMLAttributes<HTMLInputElement> {
  containerClassName?: string;
  onClear?: () => void;
  onSearch?: (value: string) => void;
}

export const SearchBar = React.forwardRef<HTMLInputElement, SearchBarProps>(
  (
    {
      className,
      containerClassName,
      value,
      onChange,
      onClear,
      onSearch,
      ...props
    },
    ref,
  ) => {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && onSearch) {
        onSearch(String(value || ""));
      }
      if (props.onKeyDown) props.onKeyDown(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (onChange) onChange(e);
      if (onSearch) onSearch(e.target.value);
    };
    const hasValue =
      value !== undefined && value !== null && String(value).length > 0;

    return (
      <div
        className={cn("relative flex items-center w-full", containerClassName)}
      >
        {/* Search Icon */}
        <div className="absolute left-4 text-text-tertiary pointer-events-none">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </div>
        {/* Input Field */}
        <input
          ref={ref}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className={cn(
            "w-full bg-background-secondary border border-border-default rounded-2xl py-3 pl-11 pr-11 text-text-primary placeholder:text-text-tertiary outline-none focus:border-brand-vibrant focus:bg-background-tertiary transition-all",
            className,
          )}
          {...props}
        />

        {/* Clear Button (Optional) */}
        {hasValue && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-4 text-text-tertiary hover:text-text-primary transition-colors focus:outline-none"
            aria-label="Clear search"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        )}
      </div>
    );
  },
);

SearchBar.displayName = "SearchBar";
