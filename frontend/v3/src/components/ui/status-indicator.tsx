import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const statusIndicatorVariants = cva(
  "relative flex h-2.5 w-2.5",
  {
    variants: {
      variant: {
        info: "bg-blue-500",
        warning: "bg-amber-500",
        error: "bg-red-500",
        success: "bg-green-500",
        muted: "bg-slate-400",
      },
      pulse: {
        true: "",
        false: "",
      },
    },
    compoundVariants: [
      {
        pulse: true,
        variant: "info",
        className: "after:absolute after:inline-flex after:h-full after:w-full after:animate-ping after:rounded-full after:bg-blue-400 after:opacity-75",
      },
      {
        pulse: true,
        variant: "warning",
        className: "after:absolute after:inline-flex after:h-full after:w-full after:animate-ping after:rounded-full after:bg-amber-400 after:opacity-75",
      },
      {
        pulse: true,
        variant: "error",
        className: "after:absolute after:inline-flex after:h-full after:w-full after:animate-ping after:rounded-full after:bg-red-400 after:opacity-75",
      },
      {
        pulse: true,
        variant: "success",
        className: "after:absolute after:inline-flex after:h-full after:w-full after:animate-ping after:rounded-full after:bg-green-400 after:opacity-75",
      },
    ],
    defaultVariants: {
      variant: "info",
      pulse: false,
    },
  }
)

export interface StatusIndicatorProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statusIndicatorVariants> {}

function StatusIndicator({ className, variant, pulse, ...props }: StatusIndicatorProps) {
  return (
    <div
      className={cn(statusIndicatorVariants({ variant, pulse }), className, "rounded-full")}
      {...props}
    />
  )
}

export { StatusIndicator, statusIndicatorVariants }
