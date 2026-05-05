import React from "react";
import { cn } from "@/modules/shared/utils";

export interface FlexBoxProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * The underlying HTML element or React component to render.
   * Defaults to "div".
   */
  as?: React.ElementType;
  direction?: "row" | "col" | "row-reverse" | "col-reverse";
  align?: "start" | "end" | "center" | "baseline" | "stretch";
  justify?: "start" | "end" | "center" | "between" | "around" | "evenly";
  wrap?: "nowrap" | "wrap" | "wrap-reverse";
  gap?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12; // Standard Tailwind gap scale
}

export const FlexBox = React.forwardRef<HTMLElement, FlexBoxProps>(
  (
    {
      as: Component = "div",
      className,
      direction = "row",
      align = "stretch",
      justify = "start",
      wrap = "nowrap",
      gap,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <Component
        ref={ref}
        className={cn(
          "flex",
          {
            "flex-col": direction === "col",
            "flex-row": direction === "row",
            "flex-col-reverse": direction === "col-reverse",
            "flex-row-reverse": direction === "row-reverse",
          },
          {
            "items-start": align === "start",
            "items-end": align === "end",
            "items-center": align === "center",
            "items-baseline": align === "baseline",
            "items-stretch": align === "stretch",
          },
          {
            "justify-start": justify === "start",
            "justify-end": justify === "end",
            "justify-center": justify === "center",
            "justify-between": justify === "between",
            "justify-around": justify === "around",
            "justify-evenly": justify === "evenly",
          },
          {
            "flex-wrap": wrap === "wrap",
            "flex-nowrap": wrap === "nowrap",
            "flex-wrap-reverse": wrap === "wrap-reverse",
          },
          // Map standard gap values to Tailwind classes
          gap === 0 && "gap-0",
          gap === 1 && "gap-1",
          gap === 2 && "gap-2",
          gap === 3 && "gap-3",
          gap === 4 && "gap-4",
          gap === 5 && "gap-5",
          gap === 6 && "gap-6",
          gap === 8 && "gap-8",
          gap === 10 && "gap-10",
          gap === 12 && "gap-12",
          className,
        )}
        {...props}
      >
        {children}
      </Component>
    );
  },
);

FlexBox.displayName = "FlexBox";
