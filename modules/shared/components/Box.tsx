import React from "react";
import { cn } from "@/modules/shared/utils";

export interface BoxProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * The underlying HTML element or React component to render.
   * Defaults to "div".
   */
  as?: React.ElementType;
}

export const Box = React.forwardRef<HTMLElement, BoxProps>(
  ({ as: Component = "div", className, children, ...props }, ref) => {
    return (
      <Component ref={ref} className={cn("box-border", className)} {...props}>
        {children}
      </Component>
    );
  },
);

Box.displayName = "Box";
