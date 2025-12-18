import { cn } from "@/shared/utils/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-muted animate-pulse rounded-sm", className)}
      {...props}
    />
  );
}

export { Skeleton };
