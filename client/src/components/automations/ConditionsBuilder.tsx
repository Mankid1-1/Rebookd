/**
 * Conditions Builder Component
 *
 * Visual rule builder for automation conditions.
 * Adapts based on skill level:
 * - Basic: Hidden (all leads)
 * - Intermediate: Preset dropdown
 * - Advanced: Full conditions builder with AND/OR groups
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ChevronDown } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface Condition {
  field: string;
  operator: string;
  value: unknown;
}

interface ConditionGroup {
  logic: "AND" | "OR";
  conditions: Array<Condition | ConditionGroup>;
}

const FIELDS = [
  { value: "lead.status", label: "Status", type: "select", options: ["new", "contacted", "qualified", "booked", "lost", "unsubscribed"] },
  { value: "lead.source", label: "Source", type: "text" },
  { value: "lead.tags", label: "Tags", type: "text" },
  { value: "lead.email", label: "Email", type: "text" },
  { value: "lead.name", label: "Name", type: "text" },
  { value: "lead.createdAt", label: "Created Date", type: "date" },
  { value: "lead.lastMessageAt", label: "Last Message", type: "date" },
  { value: "lead.lastInboundAt", label: "Last Reply", type: "date" },
  { value: "lead.appointmentAt", label: "Appointment Date", type: "date" },
];

const OPERATORS: Record<string, Array<{ value: string; label: string }>> = {
  text: [
    { value: "equals", label: "equals" },
    { value: "not_equals", label: "not equals" },
    { value: "contains", label: "contains" },
    { value: "not_contains", label: "doesn't contain" },
    { value: "exists", label: "is set" },
    { value: "not_exists", label: "is not set" },
  ],
  select: [
    { value: "equals", label: "is" },
    { value: "not_equals", label: "is not" },
    { value: "in", label: "is one of" },
  ],
  date: [
    { value: "before", label: "before" },
    { value: "after", label: "after" },
    { value: "exists", label: "is set" },
    { value: "not_exists", label: "is not set" },
  ],
};

interface ConditionsBuilderProps {
  value: ConditionGroup | null;
  onChange: (conditions: ConditionGroup | null) => void;
  skillLevel: "basic" | "intermediate" | "advanced";
}

export function ConditionsBuilder({ value, onChange, skillLevel }: ConditionsBuilderProps) {
  // Basic: No conditions UI
  if (skillLevel === "basic") {
    return (
      <div className="p-3 bg-muted/30 rounded-lg text-center">
        <p className="text-xs text-muted-foreground">Applies to all leads</p>
      </div>
    );
  }

  // Intermediate: Preset dropdown
  if (skillLevel === "intermediate") {
    return <PresetSelector value={value} onChange={onChange} />;
  }

  // Advanced: Full builder
  return <FullConditionsBuilder value={value} onChange={onChange} />;
}

function PresetSelector({
  value,
  onChange,
}: {
  value: ConditionGroup | null;
  onChange: (v: ConditionGroup | null) => void;
}) {
  const { data: presets } = trpc.segment.getPresets.useQuery();
  const [selected, setSelected] = useState<string>("all_leads");

  const handleChange = (key: string) => {
    setSelected(key);
    if (key === "all_leads") {
      onChange(null);
    } else {
      // Use the preset's conditions
      const preset = presets?.find((p) => p.key === key);
      if (preset) {
        // The actual conditions are stored server-side; for the UI we just set a marker
        onChange({
          logic: "AND",
          conditions: [{ field: "lead.status", operator: "equals", value: key === "new_leads_only" ? "new" : key === "booked_clients" ? "booked" : key === "lost_leads" ? "lost" : "qualified" }],
        });
      }
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground">Target Audience</label>
      <div className="grid grid-cols-2 gap-2">
        {[
          { key: "all_leads", label: "All Leads" },
          { key: "new_leads_only", label: "New Leads" },
          { key: "booked_clients", label: "Booked Clients" },
          { key: "at_risk", label: "At-Risk" },
          { key: "lost_leads", label: "Lost Leads" },
          { key: "qualified_leads", label: "Qualified" },
        ].map((preset) => (
          <button
            key={preset.key}
            onClick={() => handleChange(preset.key)}
            className={`px-3 py-2 rounded-md text-xs font-medium transition-colors border ${
              selected === preset.key
                ? "bg-primary/10 text-primary border-primary/30"
                : "bg-card hover:bg-muted/50 text-muted-foreground border-transparent"
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function FullConditionsBuilder({
  value,
  onChange,
}: {
  value: ConditionGroup | null;
  onChange: (v: ConditionGroup | null) => void;
}) {
  const group = value || { logic: "AND" as const, conditions: [] };

  const addCondition = () => {
    onChange({
      ...group,
      conditions: [
        ...group.conditions,
        { field: "lead.status", operator: "equals", value: "new" },
      ],
    });
  };

  const removeCondition = (index: number) => {
    const next = { ...group, conditions: group.conditions.filter((_, i) => i !== index) };
    onChange(next.conditions.length === 0 ? null : next);
  };

  const updateCondition = (index: number, updates: Partial<Condition>) => {
    const next = {
      ...group,
      conditions: group.conditions.map((c, i) => (i === index ? { ...c, ...updates } : c)),
    };
    onChange(next);
  };

  const toggleLogic = () => {
    onChange({ ...group, logic: group.logic === "AND" ? "OR" : "AND" });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground">Conditions</label>
        {group.conditions.length > 1 && (
          <button
            onClick={toggleLogic}
            className="text-xs px-2 py-0.5 rounded bg-muted hover:bg-muted/80 font-medium"
          >
            {group.logic}
          </button>
        )}
      </div>

      {group.conditions.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">
          No conditions — applies to all leads
        </p>
      )}

      {group.conditions.map((condition, index) => {
        if ("logic" in condition) return null; // Skip nested groups for now
        const cond = condition as Condition;
        const fieldDef = FIELDS.find((f) => f.value === cond.field);
        const operators = OPERATORS[fieldDef?.type || "text"];
        const needsValue = !["exists", "not_exists"].includes(cond.operator);

        return (
          <div key={index} className="flex items-center gap-2">
            {index > 0 && (
              <Badge variant="outline" className="text-[10px] shrink-0">
                {group.logic}
              </Badge>
            )}

            {/* Field */}
            <select
              value={cond.field}
              onChange={(e) => updateCondition(index, { field: e.target.value })}
              className="h-8 rounded-md border bg-background px-2 text-xs min-w-[100px]"
            >
              {FIELDS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>

            {/* Operator */}
            <select
              value={cond.operator}
              onChange={(e) => updateCondition(index, { operator: e.target.value })}
              className="h-8 rounded-md border bg-background px-2 text-xs min-w-[80px]"
            >
              {operators.map((op) => (
                <option key={op.value} value={op.value}>{op.label}</option>
              ))}
            </select>

            {/* Value */}
            {needsValue && (
              fieldDef?.type === "select" ? (
                <select
                  value={String(cond.value)}
                  onChange={(e) => updateCondition(index, { value: e.target.value })}
                  className="h-8 rounded-md border bg-background px-2 text-xs flex-1 min-w-[80px]"
                >
                  {fieldDef.options?.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : fieldDef?.type === "date" ? (
                <input
                  type="date"
                  value={String(cond.value).split("T")[0]}
                  onChange={(e) => updateCondition(index, { value: e.target.value })}
                  className="h-8 rounded-md border bg-background px-2 text-xs flex-1"
                />
              ) : (
                <input
                  type="text"
                  value={String(cond.value)}
                  onChange={(e) => updateCondition(index, { value: e.target.value })}
                  placeholder="value"
                  className="h-8 rounded-md border bg-background px-2 text-xs flex-1"
                />
              )
            )}

            <button
              onClick={() => removeCondition(index)}
              className="h-8 w-8 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        );
      })}

      <Button variant="outline" size="sm" onClick={addCondition} className="w-full">
        <Plus className="h-3 w-3 mr-1" /> Add Condition
      </Button>
    </div>
  );
}
