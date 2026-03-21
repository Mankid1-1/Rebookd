import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Phone, Mail, User, Building, Lightbulb } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createLeadSchema } from "@shared/schemas";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { SmartInput, PhoneInput, EmailInput } from "@/components/ui/SmartInput";
import { HelpTooltip } from "@/components/ui/HelpTooltip";
import { Badge } from "@/components/ui/badge";

export function AddLeadDialog() {
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();
  
  const form = useForm({
    resolver: zodResolver(createLeadSchema),
    defaultValues: { 
      phone: "", 
      name: "", 
      email: "", 
      source: "", 
      notes: "" 
    },
    mode: "onChange"
  });

  const createLead = trpc.leads.create.useMutation({
    onSuccess: () => {
      toast.success("✅ Lead added successfully! Welcome message will be sent automatically.");
      setOpen(false);
      form.reset();
      utils.leads.list.invalidate();
      utils.analytics.dashboard.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const onSubmit = form.handleSubmit((data) => {
    createLead.mutate({
      phone: data.phone,
      name: data.name || "New Lead",
      email: data.email || undefined,
      source: data.source || undefined,
      notes: data.notes || undefined,
    });
  });

  const { errors, touchedFields, isValid } = form.formState;

  const sourceOptions = [
    { value: "website", label: "Website Form", description: "Lead from website contact form" },
    { value: "phone", label: "Phone Call", description: "Lead called in directly" },
    { value: "email", label: "Email", description: "Lead sent email inquiry" },
    { value: "referral", label: "Referral", description: "Referred by existing customer" },
    { value: "social", label: "Social Media", description: "From social media platform" },
    { value: "event", label: "Event", description: "Met at trade show or event" },
    { value: "cold", label: "Cold Outreach", description: "Proactive outreach" },
    { value: "other", label: "Other", description: "Different source" }
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Lead
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Add New Lead</DialogTitle>
              <p className="text-sm text-muted-foreground">
                Add a potential customer to your pipeline
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-6">
          {/* Phone Number - Required */}
          <PhoneInput
            label="Phone Number *"
            placeholder="(555) 123-4567"
            helpText="We'll send a welcome SMS to this number"
            error={errors.phone?.message}
            success={touchedFields.phone && !errors.phone?.message && form.watch("phone") ? "Valid phone number" : undefined}
            {...form.register("phone")}
          />

          {/* Name */}
          <SmartInput
            label="Name"
            placeholder="John Doe"
            helpText="Optional but helps with personalization"
            hint="Leave blank if unknown"
            error={errors.name?.message}
            {...form.register("name")}
          />

          {/* Email */}
          <EmailInput
            label="Email Address"
            helpText="For email communications and marketing"
            hint="Optional but recommended"
            error={errors.email?.message}
            {...form.register("email")}
          />

          {/* Source */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="source">Source</Label>
              <HelpTooltip 
                content="How did this lead find out about you?"
                variant="info"
              >
                <span />
              </HelpTooltip>
            </div>
            <select
              id="source"
              className="w-full p-2 border rounded-md bg-background"
              {...form.register("source")}
            >
              <option value="">Select source...</option>
              {sourceOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {form.watch("source") && (
              <p className="text-xs text-muted-foreground">
                {sourceOptions.find(s => s.value === form.watch("source"))?.description}
              </p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="notes">Notes</Label>
              <HelpTooltip 
                content="Add any important details about this lead"
                variant="tip"
              >
                <span />
              </HelpTooltip>
            </div>
            <Textarea
              id="notes"
              placeholder="Add any relevant information about this lead..."
              className="resize-none"
              rows={3}
              {...form.register("notes")}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Optional notes for internal reference</span>
              <span>{form.watch("notes")?.length || 0}/500 characters</span>
            </div>
          </div>

          {/* What Happens Next */}
          <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-3">
              <Lightbulb className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="space-y-2">
                <h4 className="font-medium text-blue-900 dark:text-blue-100">
                  What happens next?
                </h4>
                <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                  <li>• Welcome SMS will be sent automatically</li>
                  <li>• Lead will appear in your dashboard</li>
                  <li>• You can track all communications</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            
            <div className="flex items-center gap-2">
              {form.formState.isSubmitting && (
                <Badge variant="secondary">Adding...</Badge>
              )}
              <Button 
                type="submit" 
                disabled={!isValid || createLead.isPending}
                className="gap-2"
              >
                {createLead.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Add Lead
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
