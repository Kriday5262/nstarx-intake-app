import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[4px] text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-purple-light disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-brand-gray text-white hover:bg-brand-gray-dark",
        destructive:
          "bg-brand-gray text-white hover:bg-red-50 hover:text-red-600",
        outline:
          "border border-brand-gray bg-background hover:bg-brand-gray-light hover:text-brand-ink",
        secondary:
          "bg-brand-gray-light text-brand-ink hover:bg-brand-gray/20",
        ghost: "hover:bg-brand-gray-light hover:text-brand-ink",
        link: "text-brand-purple underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-11 px-4 py-2",
        sm: "min-h-9 rounded-[4px] px-3 text-xs",
        lg: "min-h-12 rounded-[4px] px-8",
        icon: "min-h-11 min-w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        style={{ minHeight: "44px", ...(size === "icon" ? { minWidth: "44px" } : {}), ...props.style }}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
