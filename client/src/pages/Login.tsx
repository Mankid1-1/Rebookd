import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Eye, EyeOff, Gift, Loader2, Mail, Palette } from "lucide-react";
import { RebookedLogo } from "@/components/RebookedLogo";
import { useTheme, THEME_META, type ThemeName } from "@/contexts/ThemeContext";
import { trackFunnelEvent } from "@/lib/funnelEvents";
import { usePageMeta } from "@/hooks/usePageMeta";

type Tab = "signin" | "signup" | "forgot";

/** Resend verification email button */
function ResendButton({ email }: { email: string }) {
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const handleResend = async () => {
    if (!email || resending) return;
    setResending(true);
    try {
      await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setResent(true);
    } catch {
      // silently fail — endpoint always returns ok
    } finally {
      setResending(false);
    }
  };

  if (resent) {
    return (
      <p className="text-sm text-success bg-success/10 border border-success/20 rounded-lg px-3 py-2 flex items-center gap-2">
        <Mail className="w-4 h-4 shrink-0" />
        Verification email sent! Check your inbox (and spam folder).
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={handleResend}
      disabled={resending}
      className="text-sm text-primary hover:text-primary/80 underline underline-offset-2 inline-flex items-center gap-1.5 disabled:opacity-50 transition-colors"
    >
      {resending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
      {resending ? "Sending…" : "Resend verification email"}
    </button>
  );
}

/** Status banner for verify-success / verify-invalid from email link redirects */
function VerifyStatusBanner() {
  const params = new URLSearchParams(window.location.search);
  const status = params.get("status");
  const [email, setEmail] = useState("");

  if (status === "verify-success") {
    return (
      <div className="w-full max-w-md mb-4 text-sm text-success bg-success/10 border border-success/20 rounded-xl px-4 py-3 text-center">
        Email verified successfully! You can now sign in.
      </div>
    );
  }

  if (status === "verify-invalid" || status === "verify-error" || status === "verify-missing") {
    return (
      <div className="w-full max-w-md mb-4 bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 space-y-2">
        <p className="text-sm text-destructive text-center">
          {status === "verify-invalid"
            ? "That verification link is invalid or has expired."
            : status === "verify-missing"
            ? "Verification link is missing a token."
            : "We could not verify your email right now. Please try again."}
        </p>
        <div className="flex items-center gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email to resend"
            className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        {email && (
          <div className="text-center">
            <ResendButton email={email} />
          </div>
        )}
      </div>
    );
  }

  return null;
}

export default function Login() {
  usePageMeta({
    title: "Sign In — Rebooked",
    description: "Sign in to your Rebooked account or create a new one. AI-powered SMS revenue recovery for appointment businesses.",
    canonical: "https://rebooked.org/login",
  });
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<Tab>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "reset") return "forgot";
    if (params.get("ref")) return "signup"; // Auto-open signup for referral links
    return "signin";
  });

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-4">
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center mb-2 cursor-pointer" onClick={() => setLocation("/")}>
          <RebookedLogo size={36} />
        </div>
        <p className="text-sm text-muted-foreground">Revenue recovery for appointment-based businesses</p>
        <button onClick={() => setLocation("/")} className="text-xs text-muted-foreground hover:text-foreground mt-1 inline-flex items-center gap-1 py-2 px-2 min-h-[44px] rounded-md">
          <ArrowLeft className="w-3 h-3" /> Back to Home
        </button>
      </div>

      <VerifyStatusBanner />

      <div className="w-full max-w-md bg-card border border-border rounded-2xl overflow-hidden shadow-xl shadow-black/10">
        {/* Tabs */}
        <div className="flex border-b border-border">
          {([["signin", "Sign In"], ["signup", "Sign Up"], ["forgot", "Forgot"]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 py-3 min-h-[44px] text-sm font-medium transition-colors ${
                tab === key
                  ? "text-foreground bg-muted/30 border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {tab === "signin" && <SignInForm />}
          {tab === "signup" && <SignUpForm onSuccess={() => setTab("signin")} />}
          {tab === "forgot" && <ForgotForm />}
        </div>

        <div className="px-6 pb-5 text-center">
          <p className="text-xs text-muted-foreground">
            Email verification is required before your first sign in.
          </p>
        </div>
      </div>
      {/* Floating theme picker */}
      <MiniThemePicker />
    </div>
  );
}

const THEME_DOTS: Record<ThemeName, string> = {
  abyss: "#d4a843", light: "#3b7cf5", corporate: "#d44030", pink: "#d44090", emerald: "#2a9060",
};

function MiniThemePicker() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open && (
        <div className="absolute bottom-10 right-0 bg-card border border-border rounded-lg shadow-lg p-2 flex gap-1.5">
          {(Object.keys(THEME_META) as ThemeName[]).map((key) => (
            <button
              key={key}
              onClick={() => { setTheme(key); setOpen(false); }}
              className={`h-9 w-9 rounded-full border-2 transition-all ${
                theme === key ? "border-primary scale-110" : "border-transparent hover:scale-105"
              }`}
              style={{ backgroundColor: THEME_DOTS[key] }}
              title={THEME_META[key].label}
            />
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className="h-11 w-11 rounded-full bg-card border border-border shadow-md flex items-center justify-center hover:bg-muted transition-colors"
        title="Change theme"
      >
        <Palette className="h-4 w-4 text-foreground" />
      </button>
    </div>
  );
}

function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);
  const utils = trpc.useUtils();

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async () => {
      // Fetch user to check if they have a tenant
      const user = await utils.auth.me.fetch();
      if (user && !user.tenantId) {
        window.location.href = "/onboarding";
      } else {
        window.location.href = "/dashboard";
      }
    },
    onError: (err) => {
      setError(err.message);
      // Detect verification-required errors
      if (err.message.toLowerCase().includes("verify") || err.data?.code === "PRECONDITION_FAILED") {
        setNeedsVerification(true);
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNeedsVerification(false);
    if (!email || !password) {
      setError("Please fill in both fields.");
      return;
    }
    loginMutation.mutate({ email, password });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">Email address</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors text-sm"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">Password</label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors text-sm pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      {error && (
        <div className="space-y-2">
          <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">{error}</p>
          {needsVerification && email && <ResendButton email={email} />}
        </div>
      )}
      <Button type="submit" className="w-full h-11" disabled={loginMutation.isPending}>
        {loginMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        Sign In
      </Button>
    </form>
  );
}

function SignUpForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  // Honeypot field
  const [website, setWebsite] = useState("");
  // Capture referral code from URL
  const referralCode = new URLSearchParams(window.location.search).get("ref") || undefined;

  // Track signup form view
  useEffect(() => { trackFunnelEvent("signup_started"); }, []);

  const signupMutation = trpc.auth.signup.useMutation({
    onSuccess: (data) => {
      trackFunnelEvent("signup_completed", { hasReferral: !!referralCode });
      // Reddit advanced matching — re-init with hashed email for conversion attribution
      try {
        const rdt = (window as any).rdt;
        if (typeof rdt === "function" && email) {
          rdt("init", "a2_iqth093j5tj0", { email });
        }
      } catch { /* non-fatal */ }
      if (data.pendingVerification) {
        setSuccess("Check your email for a verification link. Once verified, you can sign in.");
      } else {
        setSuccess("Account created! You can now sign in.");
        setTimeout(onSuccess, 2000);
      }
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    signupMutation.mutate({ email, password, website, referralCode });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {referralCode && (
        <div className="text-sm text-success bg-success/10 border border-success/20 rounded-lg px-3 py-2 flex items-center gap-2">
          <Gift className="w-4 h-4 shrink-0" />
          You were referred! Sign up to unlock referral rewards.
        </div>
      )}
      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">Email address</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors text-sm"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">Password</label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 8 characters"
            autoComplete="new-password"
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors text-sm pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">Confirm password</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Re-enter password"
          autoComplete="new-password"
          className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors text-sm"
        />
      </div>
      {/* Honeypot */}
      <input type="text" value={website} onChange={e => setWebsite(e.target.value)} className="hidden" tabIndex={-1} autoComplete="off" />
      {error && <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">{error}</p>}
      {success && (
        <div className="space-y-2">
          <p className="text-sm text-success bg-success/10 border border-success/20 rounded-lg px-3 py-2">{success}</p>
          {email && <ResendButton email={email} />}
        </div>
      )}
      <Button type="submit" className="w-full h-11" disabled={signupMutation.isPending || !!success}>
        {signupMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        Create Account
      </Button>
    </form>
  );
}

function ForgotForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const forgotMutation = trpc.auth.forgotPassword.useMutation({
    onSuccess: () => {
      setSuccess("If an account exists with that email, you'll receive a password reset link shortly.");
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!email) {
      setError("Please enter your email address.");
      return;
    }
    forgotMutation.mutate({ email });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground mb-2">Enter your email and we'll send you a password reset link.</p>
      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">Email address</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors text-sm"
        />
      </div>
      {error && <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">{error}</p>}
      {success && <p className="text-sm text-success bg-success/10 border border-success/20 rounded-lg px-3 py-2">{success}</p>}
      <Button type="submit" className="w-full h-11" disabled={forgotMutation.isPending || !!success}>
        {forgotMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        Send Reset Link
      </Button>
    </form>
  );
}
