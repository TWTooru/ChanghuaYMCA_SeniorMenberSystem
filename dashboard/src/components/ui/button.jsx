import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "ui-button",
  {
    variants: {
      variant: {
        default: "ui-button-default",
        outline: "ui-button-outline",
        secondary: "ui-button-secondary",
        ghost: "ui-button-ghost",
        destructive: "ui-button-destructive",
        link: "ui-button-link",
      },
      size: {
        default: "ui-button-size-default",
        xs: "ui-button-size-xs",
        sm: "ui-button-size-sm",
        lg: "ui-button-size-lg",
        icon: "ui-button-size-icon",
        "icon-xs": "ui-button-size-icon-xs",
        "icon-sm": "ui-button-size-icon-sm",
        "icon-lg": "ui-button-size-icon-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props} />
  );
}

export { Button, buttonVariants }
