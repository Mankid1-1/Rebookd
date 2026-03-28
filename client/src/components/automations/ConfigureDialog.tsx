import { memo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { SmsCharCounter } from "@/components/ui/SmsCharCounter";
import type { AutomationTemplate } from "./types";

interface ConfigureDialogProps {
  template: AutomationTemplate;
  savedConfig?: Record<string, string | number>;
  open: boolean;
  onClose: () => void;
  onSave: (config: Record<string, string | number>) => void;
}

export const ConfigureDialog = memo(function ConfigureDialog({
  template,
  savedConfig,
  open,
  onClose,
  onSave,
}: ConfigureDialogProps) {
  const [config, setConfig] = useState<Record<string, string | number>>(() => {
    const defaults: Record<string, string | number> = {};
    template.configFields.forEach((f) => { defaults[f.key] = savedConfig?.[f.key] ?? f.defaultValue; });
    return defaults;
  });

  const Icon = template.icon;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-primary/10">
              <Icon className="w-4 h-4 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base">{template.name}</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{template.description}</p>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {template.configFields.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label className="text-xs font-medium">
                {field.label}
                {field.unit && <span className="text-muted-foreground ml-1">({field.unit})</span>}
              </Label>
              {field.type === "textarea" ? (
                <div>
                  <Textarea
                    className="text-sm resize-none min-h-[90px]"
                    value={config[field.key] as string}
                    onChange={(e) => setConfig((p) => ({ ...p, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                  />
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-[11px] text-muted-foreground">
                      Variables: {"{{name}}"}, {"{{business}}"}, {"{{time}}"}, {"{{date}}"}, {"{{phone}}"}
                    </p>
                    <SmsCharCounter text={String(config[field.key] ?? "")} />
                  </div>
                  {config[field.key] && String(config[field.key]).length > 10 && (
                    <div className="mt-2 p-2.5 bg-muted/40 rounded-lg border border-border">
                      <p className="text-[10px] text-muted-foreground font-medium mb-1">Preview</p>
                      <p className="text-xs text-foreground/80 leading-relaxed">
                        {String(config[field.key]).replace(/\{\{name\}\}/g, "Jane").replace(/\{\{business\}\}/g, "Your Business").replace(/\{\{time\}\}/g, "2:00 PM").replace(/\{\{date\}\}/g, "Mon Mar 24").replace(/\{\{phone\}\}/g, "+1 555 0000000")}
                      </p>
                    </div>
                  )}
                </div>
              ) : field.type === "select" ? (
                <Select
                  value={String(config[field.key])}
                  onValueChange={(v) => setConfig((p) => ({ ...p, [field.key]: v }))}
                >
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {field.options?.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  type={field.type}
                  className="text-sm"
                  value={config[field.key] as string}
                  onChange={(e) => setConfig((p) => ({ ...p, [field.key]: field.type === "number" ? (parseFloat(e.target.value) || 0) : e.target.value }))}
                  placeholder={field.placeholder}
                />
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={() => { onSave(config); onClose(); }}>Save configuration</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
