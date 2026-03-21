import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";

interface LeadsFilterProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  statusCounts: Record<string, number>;
}

const STATUSES = ["all", "new", "contacted", "qualified", "booked", "lost", "unsubscribed"];

export function LeadsFilter({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  statusCounts,
}: LeadsFilterProps) {
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
          {STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              <span className="flex items-center justify-between gap-3 w-full">
                <span>{s === "all" ? "All statuses" : s.charAt(0).toUpperCase() + s.slice(1)}</span>
                {s !== "all" && statusCounts[s] != null && (
                  <span className="text-muted-foreground text-xs">{statusCounts[s]}</span>
                )}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
