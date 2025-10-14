"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button"; // Assuming Button component is available
import { Send } from "lucide-react"; // Assuming Send icon is available

const textareaVariants = cva(
  "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "",
        ghost: "border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface StyledTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    VariantProps<typeof textareaVariants> {
  asChild?: boolean;
  onSubmit?: () => void;
  isSubmitDisabled?: boolean;
}

const StyledTextarea = React.forwardRef<HTMLTextAreaElement, StyledTextareaProps>(
  ({ className, variant, asChild, onSubmit, isSubmitDisabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "textarea";
    return (
      <div className="relative">
        <Comp
          className={cn(textareaVariants({ variant }), className)}
          ref={ref}
          {...props}
        />
        {onSubmit && !isSubmitDisabled && ( // Only render button if onSubmit is provided AND not disabled
          <Button
            type="button"
            size="icon"
            onClick={onSubmit}
            disabled={isSubmitDisabled}
            className="absolute bottom-2 right-2 h-8 w-8"
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }
);
StyledTextarea.displayName = "StyledTextarea";

export { StyledTextarea, textareaVariants };