import * as React from "react"

import { cn } from "@/lib/utils"

function Label({
  className,
  ...props
}) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-5 font-medium select-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props} />
  );
}

export { Label }
