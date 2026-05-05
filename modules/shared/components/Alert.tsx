import React from "react";
import { cn } from "@/modules/shared/utils";

export interface AlertProps {
  variant?: "info" | "success" | "warning" | "error";
  title?: string;
  message: string;
  className?: string;
}

export const Alert = ({
  variant = "info",
  title,
  message,
  className,
}: AlertProps) => {
  const variants = {
    info: {
      container: "bg-blue-500/10 border-blue-500/20 text-blue-500",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
      ),
    },
    success: {
      container: "bg-green-500/10 border-green-500/20 text-green-500",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      ),
    },
    warning: {
      container: "bg-yellow-500/10 border-yellow-500/20 text-yellow-500",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      ),
    },
    error: {
      container: "bg-red-500/10 border-red-500/20 text-red-500",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="15" x2="9" y1="9" y2="15" />
          <line x1="9" x2="15" y1="9" y2="15" />
        </svg>
      ),
    },
  };

  const activeVariant = variants[variant];

  return (
    <div
      className={cn(
        "flex items-start p-4 border rounded-xl w-full",
        activeVariant.container,
        className,
      )}
    >
      <div className="shrink-0 mr-3 mt-0.5">{activeVariant.icon}</div>
      <div>
        {title && (
          <h5 className="font-semibold mb-1 leading-none tracking-tight">
            {title}
          </h5>
        )}
        <div
          className={cn("text-sm", !title && "mt-0.5", title && "opacity-90")}
        >
          {message}
        </div>
      </div>
    </div>
  );
};
