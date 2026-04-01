import { useTheme } from "@/contexts/ThemeContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Bot, Copy, Edit2, Plus, Trash2, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useProgressiveDisclosureContext } from "@/components/ui/ProgressiveDisclosure";
import { useAuth } from "@/hooks/useAuth";
import { HelpTooltip, HelpIcon } from "@/components/ui/HelpTooltip";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Dynamic category styles based on user theme
const getDynamicCategoryStyles = (_isDarkMode: boolean) => {
  return {
    follow_up: "bg-info/15 text-info border-info/30",
    reactivation: "bg-accent/15 text-accent-foreground border-accent/30",
    appointment: "bg-success/15 text-success border-success/30",
    welcome: "bg-warning/15 text-warning border-warning/30",
    custom: "bg-muted text-muted-foreground border-muted-foreground/30",
  };
};

type TemplateForm = {
  name: string;
  body: string;
  tone: string;
};

const EMPTY_FORM: TemplateForm = { name: "", body: "", tone: "friendly" };

export default function Templates() {
  const { context } = useProgressiveDisclosureContext();
  const { user } = useAuth();
  const { data: tenant } = trpc.tenant.get.useQuery();
  
  // Dynamic category styles
  const { isDark: isDarkMode } = useTheme();
  const categoryStyles = getDynamicCategoryStyles(isDarkMode);
  
  const utils = trpc.useUtils();
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<TemplateForm>(EMPTY_FORM);
  const [category, setCategory] = useState("custom");
  const [aiPrompt, setAiPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const charCount = form.body.length;
  const smsSegments = Math.ceil(charCount / 160) || 0;

  const { data: templates = [], isLoading } = trpc.templates.list.useQuery(undefined, { retry: false });

  const createTemplate = trpc.templates.create.useMutation({
    onSuccess: () => {
      toast.success("Template created");
      setShowCreate(false);
      setForm(EMPTY_FORM);
      utils.templates.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateTemplate = trpc.templates.update.useMutation({
    onSuccess: () => {
      toast.success("Template updated");
      setEditId(null);
      setForm(EMPTY_FORM);
      utils.templates.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteTemplate = trpc.templates.delete.useMutation({
    onSuccess: () => {
      toast.success("Template deleted");
      utils.templates.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const generateAI = trpc.templates.preview.useMutation({
    onSuccess: (data: { rewritten: string }) => {
      setForm((f) => ({ ...f, body: data.rewritten }));
      setGenerating(false);
    },
    onError: (err: { message: string }) => {
      toast.error(err.message);
      setGenerating(false);
    },
  });

  const handleGenerate = () => {
    if (!aiPrompt.trim()) return;
    setGenerating(true);
    generateAI.mutate({ body: aiPrompt, tone: form.tone as any });
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.body.trim()) return toast.error("Name and body are required");
    if (editId) {
      updateTemplate.mutate({ templateId: editId, name: form.name, body: form.body, tone: form.tone as any });
    } else {
      createTemplate.mutate({ key: form.name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""), name: form.name, body: form.body, tone: form.tone as any, category: category as any });
    }
  };

  const openEdit = (tpl: typeof templates[0]) => {
    setEditId(tpl.id);
    setForm({ name: tpl.name, body: tpl.body, tone: tpl.tone });
    setCategory((tpl as any).category || "custom");
    setShowCreate(true);
  };

  const closeDialog = () => {
    setShowCreate(false);
    setEditId(null);
    setForm(EMPTY_FORM);
    setAiPrompt("");
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-5 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Templates</h1>
              <HelpIcon content={{ basic: "Pre-written messages that automations use when texting your clients", intermediate: "Message templates with merge fields. Edit wording, tone, and variables for each automation type", advanced: "Templates table linked to automations via template_id. Merge fields resolved from lead/tenant context at send time" }} />
            </div>
            <p className="text-muted-foreground text-sm mt-1">Reusable SMS message templates</p>
          </div>
          <Dialog open={showCreate} onOpenChange={(v) => { if (!v) closeDialog(); else setShowCreate(true); }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-1.5" /> New Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editId ? "Edit Template" : "New Template"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label>Template name *</Label>
                  <Input placeholder="e.g. Follow Up #1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>
                      <HelpTooltip content={{ basic: "Different message types for different situations", intermediate: "Categories match automation triggers: reminders, follow-ups, recovery, welcome, and review requests" }} variant="info">
                        Category
                      </HelpTooltip>
                    </Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="follow_up">Follow Up</SelectItem>
                        <SelectItem value="reactivation">Reactivation</SelectItem>
                        <SelectItem value="appointment">Appointment</SelectItem>
                        <SelectItem value="welcome">Welcome</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>
                      <HelpTooltip content="Adjusts the writing style of AI-generated messages for your brand voice" variant="info">
                        Tone
                      </HelpTooltip>
                    </Label>
                    <Select value={form.tone} onValueChange={(v) => setForm({ ...form, tone: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="friendly">Friendly</SelectItem>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="casual">Casual</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* AI Generator */}
                <div className="p-3 rounded-xl border border-primary/20 bg-primary/5 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-primary">
                    <Bot className="w-3.5 h-3.5" />
                    <HelpTooltip content="Uses AI to write a personalized SMS template based on your category and tone selection" variant="tip">
                      AI Message Generator
                    </HelpTooltip>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Describe what you want (e.g. 'win back clients who haven't visited in 3 months')"
                      className="text-xs h-8"
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                    />
                    <Button size="sm" variant="outline" className="h-8 shrink-0" disabled={generating || !aiPrompt.trim()} onClick={handleGenerate}>
                      <Zap className="w-3.5 h-3.5 mr-1" /> {generating ? "..." : "Generate"}
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="inline-flex items-center gap-1">
                    Message body *
                    <HelpIcon content={{ basic: "Edit what your automated messages say. Words in curly braces like {name} get replaced with real info", intermediate: "Available variables: {name}, {business}, {date}, {time}, {phone}. AI rewrite optimizes for response rate", advanced: "Variables resolved by template.service.ts renderTemplate(). AI rewrite uses OpenAI/Claude via ai.service with tenant context" }} />
                  </Label>
                  <Textarea
                    placeholder="Hi {{name}}, we'd love to see you again..."
                    value={form.body}
                    onChange={(e) => setForm({ ...form, body: e.target.value })}
                    className="resize-none min-h-[100px] text-sm"
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      <HelpTooltip content="Dynamic placeholders replaced with real client data when messages are sent" variant="info">
                        Variables: {`{{name}}`}, {`{{phone}}`}, {`{{business}}`}
                      </HelpTooltip>
                    </p>
                    {charCount > 0 && (
                      <HelpTooltip content={{ basic: "Shows how long your message is — shorter messages cost less", intermediate: "SMS segments: 160 chars for standard, 70 for unicode. Multi-segment messages count as multiple SMS", advanced: "GSM-7 encoding allows 160 chars/segment, UCS-2 (unicode) allows 70. Segment count affects per-message billing from SMS provider" }} variant="info">
                        <p className={`text-xs tabular-nums ${charCount > 160 ? "text-warning" : "text-muted-foreground"}`}>
                          {charCount} chars · {smsSegments} SMS segment{smsSegments !== 1 ? "s" : ""}
                        </p>
                      </HelpTooltip>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button variant="outline" className="flex-1" onClick={closeDialog}>Cancel</Button>
                  <Button className="flex-1" disabled={createTemplate.isPending || updateTemplate.isPending} onClick={handleSave}>
                    {editId ? "Update" : "Create"} Template
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Templates Grid */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Loading templates...</div>
        ) : templates.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border rounded-2xl">
            <Zap className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold mb-1">No templates yet</h3>
            <p className="text-muted-foreground text-sm mb-4">Create reusable message templates to speed up your workflow.</p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4 mr-1.5" /> Create Template
            </Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {templates.map((tpl) => (
              <Card key={tpl.id} className="border-border bg-card hover:border-primary/20 transition-all">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-sm">{tpl.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 rounded-full text-[10px] border bg-muted text-muted-foreground border-muted-foreground/30 capitalize">
                          {(tpl as any).category?.replace("_", " ") || "custom"}
                        </span>
                        <span className="text-[10px] text-muted-foreground capitalize">{tpl.tone}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => { navigator.clipboard.writeText(tpl.body); toast.success("Copied!"); }}
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Copy this template to clipboard</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(tpl)}>
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Edit this template</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <AlertDialog>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                            </TooltipTrigger>
                            <TooltipContent><p>Delete this template permanently</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete template?</AlertDialogTitle>
                            <AlertDialogDescription>This will permanently delete "{tpl.name}".</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deleteTemplate.mutate({ templateId: tpl.id })}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">{tpl.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
