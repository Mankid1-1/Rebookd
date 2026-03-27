import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import { useDynamicStatuses } from "@/hooks/useDynamicConfiguration";

interface LeadsFilterProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  statusCounts: Record<string, number>;
}

export function LeadsFilter({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  statusCounts,
}: LeadsFilterProps) {
  const statuses = useDynamicStatuses();
  
  // Add "all" option to the beginning
  const allStatuses = [
    { value: "all", label: "All statuses", color: "", order: 0, enabled: true },
    ...statuses
  ];
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, phone or email…"
          className="pl-9"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <Select value={statusFilter} onValueChange={onStatusFilterChange}>
        <SelectTrigger className="w-44 shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {allStatuses.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              <span className="flex items-center justify-between gap-3 w-full">
                <span>{s.label}</span>
                {s.value !== "all" && statusCounts[s.value] != null && (
                  <span className="text-muted-foreground text-xs">{statusCounts[s.value]}</span>
                )}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
