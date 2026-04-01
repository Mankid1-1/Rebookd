import { Button } from "@/components/ui/button";
import { Home, ArrowLeft } from "lucide-react";
import { RebookedIcon } from "@/components/RebookedLogo";
import { useLocation } from "wouter";
import { useLocale } from "@/contexts/LocaleContext";

export default function NotFound() {
  const [location, setLocation] = useLocation();
  const { t } = useLocale();

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="flex justify-center mx-auto mb-6">
          <RebookedIcon size={56} />
        </div>
        <h1 className="text-7xl font-bold text-primary mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          404
        </h1>
        <h2 className="text-xl font-semibold mb-2">{t('notFound.title')}</h2>
        <p className="text-muted-foreground text-sm mb-8">
          {t('notFound.description')}
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" onClick={() => window.history.back()} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> {t('common.goBack')}
          </Button>
          <Button onClick={() => setLocation("/dashboard")} className="gap-2">
            <Home className="w-4 h-4" /> {t('common.dashboard')}
          </Button>
        </div>
      </div>
    </div>
  );
}
