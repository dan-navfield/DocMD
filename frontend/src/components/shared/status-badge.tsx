import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusConfig: Record<
  string,
  { label: string; className: string; dot: string }
> = {
  received: {
    label: "Received",
    className: "bg-[#edebe0] text-[#44403a] border-[#dddacc]",
    dot: "bg-[#94908a]",
  },
  converted: {
    label: "Converted",
    className: "bg-blue-50 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
  },
  exported: {
    label: "Exported",
    className: "bg-[#fafd99]/10 text-[#3b432f] border-[#d8db6e]",
    dot: "bg-[#4c573e]",
  },
  pending: {
    label: "Pending",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
  },
  processing: {
    label: "Processing",
    className: "bg-blue-50 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
  },
  completed: {
    label: "Completed",
    className: "bg-[#fafd99]/10 text-[#3b432f] border-[#d8db6e]",
    dot: "bg-[#4c573e]",
  },
  failed: {
    label: "Failed",
    className: "bg-red-50 text-red-700 border-red-200",
    dot: "bg-red-500",
  },
};

export function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || statusConfig.received;
  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 font-medium", config.className)}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
      {config.label}
    </Badge>
  );
}
