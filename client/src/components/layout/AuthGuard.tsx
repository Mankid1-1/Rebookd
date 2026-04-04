import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Loader2, Lock, Shield } from "lucide-react";

interface AuthGuardProps {
  children: React.ReactNode;
  adminOnly?: boolean;
  tenantOnly?: boolean;
  fallback?: React.ReactNode;
}

export function AuthGuard({ children, adminOnly = false, tenantOnly = false, fallback }: AuthGuardProps) {
  const authState = useAuth({ redirectOnUnauthenticated: false });
  const user = authState.user;
  const isLoading = authState.loading;
  const error = authState.error;
  const [, navigate] = useLocation();
  const [redirecting, setRedirecting] = useState(false);

  // Prevent search engines from indexing any authenticated page
  useEffect(() => {
    let meta = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "robots");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", "noindex, nofollow");
    return () => { meta?.remove(); };
  }, []);

  useEffect(() => {
    if (!isLoading && !user && !redirecting) {
      setRedirecting(true);
      // Preserve the current path for redirect after login
      const currentPath = window.location.pathname + window.location.search;
      sessionStorage.setItem('redirectPath', currentPath);
      window.location.href = "/login";
      return;
    }

    if (!isLoading && user && adminOnly && user.role !== "admin") {
      navigate("/dashboard");
      return;
    }

    if (!isLoading && user && tenantOnly && user.role === "admin") {
      navigate("/admin/tenants");
      return;
    }
  }, [user, isLoading, adminOnly, tenantOnly, navigate, redirecting]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen" role="status" aria-label="Loading authentication">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="max-w-md w-full space-y-4">
          <Alert variant="destructive">
            <Lock className="h-4 w-4" />
            <AlertDescription>
              Authentication error occurred. Please try logging in again.
            </AlertDescription>
          </Alert>
          <Button 
            onClick={() => window.location.href = "/login"} 
            className="w-full"
            aria-label="Go to login page"
          >
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  if (!user) {
    return fallback || (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="max-w-md w-full space-y-4">
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              Authentication required. Please log in to access this page.
            </AlertDescription>
          </Alert>
          <Button 
            onClick={() => window.location.href = "/login"} 
            className="w-full"
            aria-label="Go to login page"
          >
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  if (tenantOnly && user.role === "admin") {
    return fallback || (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="max-w-md w-full space-y-4">
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              This page is for tenant users only. Admin accounts manage the platform from the admin panel.
            </AlertDescription>
          </Alert>
          <Button
            onClick={() => navigate("/admin/tenants")}
            className="w-full"
            aria-label="Go to admin panel"
          >
            Go to Admin Panel
          </Button>
        </div>
      </div>
    );
  }

  if (adminOnly && user.role !== "admin") {
    return fallback || (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="max-w-md w-full space-y-4">
          <Alert>
            <Lock className="h-4 w-4" />
            <AlertDescription>
              Admin access required. You don't have permission to view this page.
            </AlertDescription>
          </Alert>
          <Button 
            onClick={() => navigate("/dashboard")} 
            className="w-full"
            aria-label="Go to dashboard"
          >
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
