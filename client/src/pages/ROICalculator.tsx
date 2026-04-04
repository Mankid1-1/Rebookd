import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { RebookedLogo } from "@/components/RebookedLogo";
import { usePageMeta } from "@/hooks/usePageMeta";
import { INDUSTRIES } from "@/data/industries";
import { trackFunnelEvent } from "@/lib/funnelEvents";
import { useTheme, THEME_META, type ThemeName } from "@/contexts/ThemeContext";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  Zap,
  ShieldCheck,
  Palette,
} from "lucide-react";

// ── Constants ──────────────────────────────────────────────────────────────

const NO_SHOW_RECOVERY_RATE = 0.40;
const CANCELLATION_RECOVERY_RATE = 0.55;
const PLATFORM_FEE = 199;
const REVENUE_SHARE = 0.15;

const industryList = Object.values(INDUSTRIES).sort((a, b) =>
  a.name.localeCompare(b.name),
);

function fmt(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}
function fmtCurrency(n: number): string {
  return "$" + fmt(n);
}

// ── Compact Slider ────────────────────────────────────────────────────────

type SliderColor = "teal" | "amber" | "rose";

const SP: Record<SliderColor, { track: string; trackTo: string; iconBg: string; iconText: string; valueBg: string; valueText: string; border: string }> = {
  teal:  { track: "#00A896", trackTo: "#00C9A7", iconBg: "bg-[#00A896]/15", iconText: "text-[#00A896]", valueBg: "bg-[#00A896]/10 border border-[#00A896]/20", valueText: "text-[#00A896]", border: "border-[#00A896]/20" },
  amber: { track: "#F59E0B", trackTo: "#FBBF24", iconBg: "bg-amber-500/15",  iconText: "text-amber-500",  valueBg: "bg-amber-500/10 border border-amber-500/20",  valueText: "text-amber-500",  border: "border-amber-500/20" },
  rose:  { track: "#F43F5E", trackTo: "#FB7185", iconBg: "bg-rose-500/15",   iconText: "text-rose-500",   valueBg: "bg-rose-500/10 border border-rose-500/20",   valueText: "text-rose-500",   border: "border-rose-500/20" },
};

function Slider({ label, value, onChange, min, max, step = 1, prefix = "", icon, color = "teal" }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number;
  step?: number; prefix?: string; icon?: React.ReactNode; color?: SliderColor;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const p = SP[color];
  return (
    <div className={`rounded-lg border ${p.border} bg-card p-3`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {icon && <span className={`inline-flex items-center justify-center w-6 h-6 rounded ${p.iconBg}`}><span className={p.iconText}>{icon}</span></span>}
          <span className="text-xs font-semibold text-foreground">{label}</span>
        </div>
        <span className={`rounded px-2 py-0.5 text-sm font-extrabold tabular-nums ${p.valueBg} ${p.valueText}`}>{prefix}{fmt(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(+e.target.value)}
        className="w-full h-2 rounded-full appearance-none cursor-pointer slider-input"
        style={{ background: `linear-gradient(to right, ${p.track} 0%, ${p.trackTo} ${pct}%, hsl(var(--muted)) ${pct}%, hsl(var(--muted)) 100%)` }}
      />
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
        <span>{prefix}{fmt(min)}</span><span>{prefix}{fmt(max)}</span>
      </div>
    </div>
  );
}

// ── Theme Colors ──────────────────────────────────────────────────────────

const THEME_COLORS: Record<ThemeName, string> = {
  abyss: "bg-[#0D1B2A]", light: "bg-[#f0f4f8]", corporate: "bg-white", pink: "bg-[#fce4ec]", emerald: "bg-[#065f46]",
};

// ── Page ──────────────────────────────────────────────────────────────────

export default function ROICalculator() {
  const [, navigate] = useLocation();
  const { theme, setTheme } = useTheme();
  const [themeOpen, setThemeOpen] = useState(false);
  const [avgValue, setAvgValue] = useState(80);
  const [noShows, setNoShows] = useState(20);
  const [cancellations, setCancellations] = useState(15);
  const [selectedIndustry, setSelectedIndustry] = useState("");

  usePageMeta({
    title: "Lost Revenue Calculator — See What No-Shows Cost You | Rebooked",
    description: "Calculate your revenue leakage from no-shows and cancellations. See exactly how much Rebooked can recover with AI-powered SMS automation.",
    ogUrl: "https://rebooked.org/lostrevenuecalculator",
    canonical: "https://rebooked.org/lostrevenuecalculator",
  });

  const calc = useMemo(() => {
    const noShowLoss = noShows * avgValue;
    const cancLoss = cancellations * avgValue;
    const totalLoss = noShowLoss + cancLoss;
    const recNS = Math.round(noShows * NO_SHOW_RECOVERY_RATE);
    const recCanc = Math.round(cancellations * CANCELLATION_RECOVERY_RATE);
    const totalRec = recNS + recCanc;
    const gross = totalRec * avgValue;
    const revShare = Math.round(gross * REVENUE_SHARE);
    const cost = PLATFORM_FEE + revShare;
    const net = gross - cost;
    const roi = cost > 0 ? Math.round((net / cost) * 100) : 0;
    return { noShowLoss, cancLoss, totalLoss, totalLossYr: totalLoss * 12, recNS, recCanc, totalRec, gross, revShare, cost, net, netYr: net * 12, roi };
  }, [avgValue, noShows, cancellations]);

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* Nav */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="max-w-6xl mx-auto px-4 h-12 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2"><RebookedLogo className="h-6" /></a>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button onClick={() => setThemeOpen(!themeOpen)} className="flex items-center gap-1 px-2 py-1 rounded-lg border border-border hover:bg-muted/50 transition-colors text-muted-foreground text-xs" aria-label="Theme">
                <Palette className="w-3.5 h-3.5" /><span className="hidden sm:inline">{THEME_META[theme].label}</span>
              </button>
              {themeOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setThemeOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-xl border border-border bg-card shadow-xl p-1">
                    {(Object.keys(THEME_META) as ThemeName[]).map((key) => (
                      <button key={key} onClick={() => { setTheme(key); setThemeOpen(false); }}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left ${theme === key ? "bg-[#00A896]/10 text-[#00A896] font-medium" : "hover:bg-muted/50 text-foreground"}`}>
                        <span className={`w-3.5 h-3.5 rounded-full border border-border ${THEME_COLORS[key]}`} />{THEME_META[key].label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <Button size="sm" className="bg-[#00A896] hover:bg-[#00A896]/90 text-white text-xs h-8" onClick={() => navigate("/login")}>Get Started Free</Button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-5 sm:py-6">

        {/* Hero — single line */}
        <div className="text-center mb-5">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
            Every empty chair is <span className="text-red-400">money you already earned</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Drag the sliders, see the damage, then let Rebooked fix it.</p>
        </div>

        {/* ═══ Main grid: sliders LEFT | results RIGHT ═══ */}
        <div className="grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 mb-4">

          {/* ── LEFT: sliders ── */}
          <div className="space-y-2">
            <Slider label="Avg appointment value" value={avgValue} onChange={setAvgValue} min={20} max={500} step={5} prefix="$" icon={<DollarSign className="w-3.5 h-3.5" />} color="teal" />
            <Slider label="No-shows / month" value={noShows} onChange={setNoShows} min={0} max={100} icon={<AlertTriangle className="w-3.5 h-3.5" />} color="amber" />
            <Slider label="Cancellations / month" value={cancellations} onChange={setCancellations} min={0} max={100} icon={<TrendingDown className="w-3.5 h-3.5" />} color="rose" />
          </div>

          {/* ── RIGHT: results stacked ── */}
          <div className="grid grid-rows-2 gap-3">

            {/* You're losing */}
            <div className="rounded-xl border-2 border-red-500/20 bg-gradient-to-br from-red-500/5 to-transparent p-4">
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-red-400 flex items-center gap-1"><TrendingDown className="w-3 h-3" />You're losing</p>
                <div className="text-right">
                  <span className="text-xl font-extrabold text-red-400 tabular-nums">-{fmtCurrency(calc.totalLoss)}</span>
                  <span className="text-red-400/50 text-xs">/mo</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <div>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-muted-foreground">No-shows ({noShows} x {fmtCurrency(avgValue)})</span>
                    <span className="font-semibold text-red-400">-{fmtCurrency(calc.noShowLoss)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-red-500 to-red-400 transition-all duration-500"
                      style={{ width: `${calc.totalLoss > 0 ? (calc.noShowLoss / calc.totalLoss) * 100 : 0}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-muted-foreground">Cancellations ({cancellations} x {fmtCurrency(avgValue)})</span>
                    <span className="font-semibold text-red-400">-{fmtCurrency(calc.cancLoss)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-orange-400 transition-all duration-500"
                      style={{ width: `${calc.totalLoss > 0 ? (calc.cancLoss / calc.totalLoss) * 100 : 0}%` }} />
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2 text-right">{fmtCurrency(calc.totalLossYr)}/yr if nothing changes</p>
            </div>

            {/* Rebooked recovers */}
            <div className="rounded-xl border-2 border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent p-4">
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-1"><TrendingUp className="w-3 h-3" />Rebooked recovers</p>
                <div className="text-right">
                  <span className={`text-xl font-extrabold tabular-nums ${calc.net >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {calc.net >= 0 ? "+" : ""}{fmtCurrency(calc.net)}
                  </span>
                  <span className="text-emerald-400/50 text-xs">/mo</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                <span className="text-muted-foreground">No-shows saved ({noShows} x 40%)</span>
                <span className="text-right font-semibold text-emerald-400">+{fmtCurrency(calc.recNS * avgValue)}</span>
                <span className="text-muted-foreground">Cancellations rebooked ({cancellations} x 55%)</span>
                <span className="text-right font-semibold text-emerald-400">+{fmtCurrency(calc.recCanc * avgValue)}</span>
                <span className="text-muted-foreground">Platform fee + 15% share</span>
                <span className="text-right text-muted-foreground">-{fmtCurrency(calc.cost)}</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2 text-right">{calc.roi}% ROI for every $1 spent</p>
            </div>
          </div>
        </div>

        {/* ═══ Yearly bar + CTA ═══ */}
        <div className="rounded-xl border-2 border-[#00A896]/25 bg-gradient-to-r from-[#00A896]/8 via-[#00A896]/4 to-transparent p-4 mb-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 sm:gap-6">
              <div>
                <p className="text-xs text-muted-foreground">12-month net profit</p>
                <p className="text-2xl sm:text-3xl font-extrabold text-[#00A896] tabular-nums leading-tight">{fmtCurrency(calc.netYr)}</p>
                <div className="flex items-center gap-1 mt-0.5 text-[10px] text-[#00A896]">
                  <ShieldCheck className="w-3 h-3" /><span className="font-medium">35-day ROI guarantee</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-52">
                <select value={selectedIndustry}
                  onChange={(e) => { setSelectedIndustry(e.target.value); if (e.target.value) trackFunnelEvent("roi_calculator_industry_select", { industry: e.target.value }); }}
                  className="w-full appearance-none rounded-lg border-2 border-border bg-card px-3 py-2 pr-8 text-xs font-medium text-foreground focus:border-[#00A896] outline-none cursor-pointer">
                  <option value="">Your industry...</option>
                  {industryList.map((ind) => <option key={ind.slug} value={ind.slug}>{ind.emoji} {ind.name}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              </div>
              <Button size="sm" disabled={!selectedIndustry}
                onClick={() => { if (selectedIndustry) { trackFunnelEvent("roi_calculator_cta_click", { industry: selectedIndustry }); navigate(`/for/${selectedIndustry}`); } }}
                className="bg-[#00A896] hover:bg-[#00A896]/90 text-white text-xs h-9 px-4 rounded-lg disabled:opacity-40 shrink-0">
                Go <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </div>

        {/* ═══ 3 stat boxes ═══ */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-border bg-card/50 p-3 text-center">
            <Zap className="w-4 h-4 text-[#00A896] mx-auto mb-0.5" />
            <p className="text-lg font-extrabold text-[#00A896] tabular-nums">{calc.totalRec}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">appointments saved/mo</p>
          </div>
          <div className="rounded-lg border border-border bg-card/50 p-3 text-center">
            <DollarSign className="w-4 h-4 text-emerald-400 mx-auto mb-0.5" />
            <p className="text-lg font-extrabold text-emerald-400 tabular-nums">{fmtCurrency(calc.gross)}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">recovered/mo</p>
          </div>
          <div className="rounded-lg border border-border bg-card/50 p-3 text-center">
            <TrendingUp className="w-4 h-4 text-amber-400 mx-auto mb-0.5" />
            <p className="text-lg font-extrabold text-amber-400 tabular-nums">{calc.roi}%</p>
            <p className="text-[10px] text-muted-foreground leading-tight">return on investment</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-4 px-4 mt-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1.5"><RebookedLogo className="h-4 opacity-60" /><span>&copy; {new Date().getFullYear()} Rebooked</span></div>
          <div className="flex gap-3">
            <a href="/privacy" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-foreground transition-colors">Terms</a>
            <a href="/support" className="hover:text-foreground transition-colors">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
