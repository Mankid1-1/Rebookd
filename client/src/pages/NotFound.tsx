import { Button } from "@/components/ui/button";
import { Home, ArrowLeft, Zap } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [location, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <Zap className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-7xl font-bold text-primary mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          404
        </h1>
        <h2 className="text-xl font-semibold mb-2">Page not found</h2>
        <p className="text-muted-foreground text-sm mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" onClick={() => window.history.back()} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Go back
          </Button>
          <Button onClick={() => setLocation("/dashboard")} className="gap-2">
            <Home className="w-4 h-4" /> Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
