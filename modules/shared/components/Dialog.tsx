"use client";

import React from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { cn } from "@/modules/shared/utils";

export interface DialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  isDestructive?: boolean;
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  isLoading = false,
  isDestructive = false,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      className="max-w-[340px] text-center p-6"
    >
      {/* Top Gradient Accent */}
      <div
        className={cn(
          "absolute top-0 left-0 right-0 h-24 bg-gradient-to-b opacity-15 pointer-events-none",
          isDestructive
            ? "from-red-500 to-transparent"
            : "from-brand-vibrant to-transparent",
        )}
      />

      <div className="relative flex flex-col items-center">
        {/* Icon Header */}
        <div className="mb-4 p-2 rounded-full bg-background-tertiary">
          <div
            className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center text-white",
              isDestructive
                ? "bg-gradient-to-br from-red-500 to-red-700"
                : "bg-gradient-to-br from-brand-vibrant to-brand-core",
            )}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
        </div>

        <h3 className="text-xl font-bold text-text-primary mb-2 tracking-tight">
          {title}
        </h3>

        <p className="text-sm text-text-secondary leading-relaxed mb-6 px-2">
          {message}
        </p>

        <div className="flex w-full gap-3">
          <Button
            variant="secondary"
            className="flex-1 font-semibold border-none"
            onClick={onCancel}
            disabled={isLoading}
          >
            {cancelText}
          </Button>

          <Button
            variant={isDestructive ? "secondary" : "primary"}
            className={cn(
              "flex-1 font-bold",
              isDestructive && "bg-red-500 hover:bg-red-600 border-none",
            )}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="w-5 h-5 flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              </div>
            ) : (
              confirmText
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
