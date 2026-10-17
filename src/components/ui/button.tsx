import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Launcher look (see theme.ts): quiet white-alpha buttons, cyan when on
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400 disabled:pointer-events-none disabled:opacity-40 [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:mr-0 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // On / primary
        default: "bg-cyan-500 text-black font-semibold hover:bg-cyan-400",
        destructive: "bg-red-600 text-white hover:bg-red-500",
        // Neutral (off)
        outline: "bg-white/10 text-white hover:bg-white/20",
        secondary: "bg-white/15 text-white hover:bg-white/25",
        ghost: "text-gray-300 hover:bg-white/10 hover:text-white",
        link: "text-cyan-300 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 px-3",
        sm: "h-7 px-2.5",
        lg: "h-9 px-4 text-sm",
        icon: "h-7 w-7",
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
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }

