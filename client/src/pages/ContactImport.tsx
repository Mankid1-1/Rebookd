import DashboardLayout from "@/components/layout/DashboardLayout";
import { EncryptionBadge } from "@/components/ui/EncryptionBadge";
import { trpc } from "@/lib/trpc";
import { useState, useCallback, useRef } from "react";
import { HelpTooltip, HelpIcon } from "@/components/ui/HelpTooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  Users,
  CheckCircle,
  AlertTriangle,
  Loader2,
  FileText,
  Smartphone,
  ArrowRight,
  SkipForward,
  Merge,
  RefreshCw,
  History,
  Calendar,
  Link2,
} from "lucide-react";
import { toast } from "sonner";

type Step = "choose" | "csv-format" | "preview" | "options" | "importing" | "done";
type ImportMode = "skip_duplicates" | "merge_info" | "overwrite";
type CsvFormat = "square" | "vagaro" | "booksy" | "fresha" | "generic";

interface ParsedContact {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  source?: string;
}

export default function ContactImport() {
  const [step, setStep] = useState<Step>("choose");
  const [contacts, setContacts] = useState<ParsedContact[]>([]);
  const [preview, setPreview] = useState<{ total: number; new: number; duplicates: number; skipped: number } | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>("skip_duplicates");
  const [importResult, setImportResult] = useState<any>(null);
  const [csvFormat, setCsvFormat] = useState<CsvFormat>("generic");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const csvImportMutation = trpc.leads.csvImport.useMutation({
    onSuccess: (result: any) => {
      setImportResult({ imported: result.imported, duplicates: result.duplicates, skipped: result.skipped });
      setStep("done");
      toast.success(`Imported ${result.imported} contacts from CSV`);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleCsvSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setStep("importing");
      csvImportMutation.mutate({ csvContent: content, format: csvFormat });
    };
    reader.readAsText(file);
  }, [csvFormat]);

  const parseVcardMutation = trpc.contactImport.parseVcard.useMutation({
    onSuccess: (data) => {
      setContacts(data.contacts);
      setPreview(data.preview);
      setStep("preview");
    },
    onError: (err) => toast.error(err.message),
  });

  const fetchGoogleMutation = trpc.contactImport.fetchGoogleContacts.useMutation({
    onSuccess: (data) => {
      setContacts(data.contacts);
      setPreview(data.preview);
      setStep("preview");
    },
    onError: (err) => toast.error(err.message),
  });

  const executeMutation = trpc.contactImport.execute.useMutation({
    onSuccess: (result) => {
      setImportResult(result);
      setStep("done");
      toast.success(`Imported ${result.imported} contacts`);
    },
    onError: (err) => toast.error(err.message),
  });

  const { data: history } = trpc.contactImport.history.useQuery({ limit: 10 });

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".vcf") && !file.name.endsWith(".vcard")) {
      toast.error("Please select a .vcf or .vcard file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      parseVcardMutation.mutate({ vcfContent: content });
    };
    reader.readAsText(file);
  }, []);

  const handleExecute = () => {
    setStep("importing");
    executeMutation.mutate({
      contacts: contacts.map((c) => ({
        ...c,
        source: c.source as "vcard" | "google_contacts" | "csv",
      })),
      mode: importMode,
    });
  };

  const resetFlow = () => {
    setStep("choose");
    setContacts([]);
    setPreview(null);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Import Contacts</h1>
            <HelpIcon content={{ basic: "Bring in your existing client list from a spreadsheet", intermediate: "Bulk import contacts from CSV with deduplication and TCPA consent tracking", advanced: "CSV parsing with column mapping. Dedup on phone number. Consent flags set per import batch. Validated against E.164 phone format" }} />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Import contacts from your phone, booking software, or calendar
          </p>
        </div>

        {/* Step: Choose Source */}
        {step === "choose" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* vCard Upload */}
              <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => fileInputRef.current?.click()}>
                <CardContent className="p-6 text-center">
                  <div className="p-3 bg-primary/10 rounded-full w-fit mx-auto mb-3">
                    <Upload className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-1"><HelpTooltip content="Import contacts directly from a .vcf file exported from your phone's contacts app" variant="info">Phone Contacts</HelpTooltip></h3>
                  <p className="text-xs text-muted-foreground">
                    Upload .vcf from iPhone (Share Contact → All) or Android (Export to file)
                  </p>
                  {parseVcardMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin mx-auto mt-2" />
                  )}
                </CardContent>
              </Card>

              {/* Google Contacts */}
              <Card
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fetchGoogleMutation.mutate()}
              >
                <CardContent className="p-6 text-center">
                  <div className="p-3 bg-destructive/10 rounded-full w-fit mx-auto mb-3">
                    <Smartphone className="h-6 w-6 text-destructive" />
                  </div>
                  <h3 className="font-semibold mb-1"><HelpTooltip content="Sync contacts from your Google account. Requires one-time permission." variant="info">Google Contacts</HelpTooltip></h3>
                  <p className="text-xs text-muted-foreground">
                    Sync from Google (requires Google Calendar connection)
                  </p>
                  {fetchGoogleMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin mx-auto mt-2" />
                  )}
                </CardContent>
              </Card>

              {/* CSV from Booking Software */}
              <Card
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => setStep("csv-format")}
              >
                <CardContent className="p-6 text-center">
                  <div className="p-3 bg-primary/10 rounded-full w-fit mx-auto mb-3">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-1"><HelpTooltip content={{ basic: "Upload a CSV or Excel file with your contacts", intermediate: "Supported: CSV with columns for name, phone, email. Auto-maps common column headers", advanced: "Parses CSV with auto-detection of delimiter. Maps columns by header name (case-insensitive). Supports Square, Vagaro, Booksy, Fresha, and generic formats" }} variant="info">CSV Import</HelpTooltip></h3>
                  <p className="text-xs text-muted-foreground">
                    Import from Square, Vagaro, Booksy, Fresha, or any CSV
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Calendar Auto-Sync Info */}
            <Card className="border-success/20 bg-success/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-success/10 rounded-lg">
                    <Calendar className="h-5 w-5 text-success" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-medium"><HelpTooltip content="When your booking software is connected, new client contacts are automatically added as leads after each appointment" variant="info">Auto-Import from Calendar</HelpTooltip></h3>
                    <p className="text-xs text-muted-foreground">
                      Contacts from calendar appointments are automatically imported as leads when you connect your booking software.
                    </p>
                    <EncryptionBadge variant="badge" className="mt-1" />
                  </div>
                  <Button variant="outline" size="sm" onClick={() => (window.location.href = "/calendar-integration")}>
                    <Link2 className="h-4 w-4 mr-1" />
                    Connect
                  </Button>
                </div>
              </CardContent>
            </Card>

            <input
              ref={fileInputRef}
              type="file"
              accept=".vcf,.vcard"
              className="hidden"
              onChange={handleFileSelect}
            />
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={handleCsvSelect}
            />

            {/* Import History */}
            {history && history.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Recent Imports
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {history.map((imp: any) => (
                      <div key={imp.id} className="flex items-center justify-between p-2 rounded border text-sm">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">{imp.source}</Badge>
                          <span className="text-muted-foreground">
                            {new Date(imp.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{imp.imported} imported</span>
                          <span>{imp.duplicates} dupes</span>
                          <span>{imp.skipped} skipped</span>
                          <Badge
                            variant={imp.status === "complete" ? "default" : "destructive"}
                            className="text-[10px]"
                          >
                            {imp.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Step: CSV Format Picker */}
        {step === "csv-format" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base"><HelpTooltip content="Rebooked knows the CSV column format used by each booking platform, so we can map fields automatically" variant="info">Select Your Booking Software</HelpTooltip></CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                  {(
                    [
                      { id: "square" as CsvFormat, label: "Square", color: "bg-black/10 text-black" },
                      { id: "vagaro" as CsvFormat, label: "Vagaro", color: "bg-accent/10 text-accent" },
                      { id: "booksy" as CsvFormat, label: "Booksy", color: "bg-primary/10 text-primary" },
                      { id: "fresha" as CsvFormat, label: "Fresha", color: "bg-success/10 text-success" },
                      { id: "generic" as CsvFormat, label: "Other CSV", color: "bg-muted text-muted-foreground" },
                    ] as const
                  ).map((fmt) => (
                    <button
                      key={fmt.id}
                      onClick={() => setCsvFormat(fmt.id)}
                      className={`p-4 rounded-lg border text-center text-sm font-medium transition-all ${
                        csvFormat === fmt.id
                          ? "border-primary ring-2 ring-primary/20"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full ${fmt.color} flex items-center justify-center mx-auto mb-2`}>
                        <FileText className="h-4 w-4" />
                      </div>
                      {fmt.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={resetFlow}>Back</Button>
                  <Button onClick={() => csvInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload {csvFormat === "generic" ? "CSV" : csvFormat.charAt(0).toUpperCase() + csvFormat.slice(1) + " Export"}
                  </Button>
                </div>
                {csvImportMutation.isPending && (
                  <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Importing contacts...
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step: Preview */}
        {step === "preview" && preview && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold">{preview.total}</p>
                  <p className="text-xs text-muted-foreground">Total Found</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-success">{preview.new}</p>
                  <p className="text-xs text-muted-foreground"><HelpTooltip content="Contacts from this import that don't exist in your leads yet" variant="info">New Contacts</HelpTooltip></p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-warning">{preview.duplicates}</p>
                  <p className="text-xs text-muted-foreground"><HelpTooltip content="Contacts that already exist in your leads list" variant="info">Duplicates</HelpTooltip></p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-muted-foreground">{preview.skipped}</p>
                  <p className="text-xs text-muted-foreground"><HelpTooltip content="Contacts filtered out because they have no phone number — required for SMS" variant="info">Skipped (No Phone)</HelpTooltip></p>
                </CardContent>
              </Card>
            </div>

            {/* Contact Preview Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contact Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-[300px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-card">
                      <tr className="border-b text-left">
                        <th className="p-2 font-medium">Name</th>
                        <th className="p-2 font-medium">Phone</th>
                        <th className="p-2 font-medium">Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contacts.slice(0, 50).map((c, i) => (
                        <tr key={i} className="border-b border-border/50">
                          <td className="p-2">{c.name || "—"}</td>
                          <td className="p-2 font-mono text-xs">{c.phone || "—"}</td>
                          <td className="p-2 text-muted-foreground">{c.email || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {contacts.length > 50 && (
                    <p className="text-xs text-muted-foreground text-center mt-2">
                      Showing first 50 of {contacts.length} contacts
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" onClick={resetFlow}>Back</Button>
              <Button onClick={() => setStep("options")} className="flex-1">
                Continue <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step: Options */}
        {step === "options" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base"><HelpTooltip content="Choose what happens when an imported contact matches someone already in your Rebooked leads" variant="info">Duplicate Handling</HelpTooltip></CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {([
                  { mode: "skip_duplicates" as ImportMode, icon: SkipForward, label: "Skip Duplicates", tooltip: "Don't import contacts that already exist in your leads list", desc: "Only import new contacts, skip existing ones" },
                  { mode: "merge_info" as ImportMode, icon: Merge, label: "Merge Info", tooltip: "Import the contact but fill in any missing details from the import file", desc: "Fill in missing details for existing contacts" },
                  { mode: "overwrite" as ImportMode, icon: RefreshCw, label: "Overwrite", tooltip: "Replace existing lead data with the newly imported information", desc: "Update existing contacts with imported data" },
                ]).map(({ mode, icon: Icon, label, tooltip, desc }) => (
                  <button
                    key={mode}
                    onClick={() => setImportMode(mode)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                      importMode === mode ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${importMode === mode ? "text-primary" : "text-muted-foreground"}`} />
                    <div>
                      <p className="text-sm font-medium"><HelpTooltip content={tooltip} variant="info">{label}</HelpTooltip></p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("preview")}>Back</Button>
              <Button onClick={handleExecute} className="flex-1">
                Import {preview?.new || 0} Contacts
              </Button>
            </div>
          </div>
        )}

        {/* Step: Importing */}
        {step === "importing" && (
          <Card>
            <CardContent className="p-12 text-center">
              <Loader2 className="h-10 w-10 animate-spin mx-auto mb-4 text-primary" />
              <p className="font-semibold">Importing contacts...</p>
              <p className="text-sm text-muted-foreground mt-1">This may take a moment</p>
            </CardContent>
          </Card>
        )}

        {/* Step: Done */}
        {step === "done" && importResult && (
          <div className="space-y-6">
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCircle className="h-12 w-12 text-success mx-auto mb-4" />
                <h2 className="text-xl font-bold mb-2">Import Complete</h2>
                <div className="flex justify-center gap-6 text-sm mt-4">
                  <div>
                    <p className="text-2xl font-bold text-success">{importResult.imported}</p>
                    <p className="text-muted-foreground">Imported</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-warning">{importResult.duplicates}</p>
                    <p className="text-muted-foreground">Duplicates</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-muted-foreground">{importResult.skipped}</p>
                    <p className="text-muted-foreground">Skipped</p>
                  </div>
                </div>
                {importResult.errors.length > 0 && (
                  <div className="mt-4 p-3 bg-destructive/10 rounded-lg text-left">
                    <p className="text-sm font-medium text-destructive flex items-center gap-1">
                      <AlertTriangle className="h-4 w-4" /> {importResult.errors.length} errors
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" onClick={resetFlow} className="flex-1">
                Import More
              </Button>
              <Button onClick={() => window.location.href = "/leads"} className="flex-1">
                <Users className="h-4 w-4 mr-2" />
                View Contacts
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
