import * as React from "react";

import { cn } from "@/shared/utils/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground font-mono font-medium flex h-11 w-full min-w-0 rounded-sm border border-input bg-background px-4 py-2.5 text-base shadow-none transition-[border-color,box-shadow] outline-none file:inline-flex file:h-9 file:border-0 file:bg-transparent file:text-base file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "focus:border-primary focus:shadow-focus",
        "aria-invalid:border-secondary",
        className
      )}
      {...props}
    />
  );
}

export { Input };
