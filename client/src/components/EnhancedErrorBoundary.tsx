import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw, RefreshCw, Bot, Loader2 } from "lucide-react";
import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { reportClientError, reportErrorBoundaryShown, initGlobalErrorHandlers } from "@/lib/reportClientError";

// Ensure global error handlers are registered once
initGlobalErrorHandlers();

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  featureName?: string;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  isHealing: boolean;
  healingElapsed: number;
}

class EnhancedErrorBoundary extends Component<Props, State> {
  private healingTimer: ReturnType<typeof setInterval> | null = null;
  private autoRetryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, isHealing: false, healingElapsed: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, errorInfo });

    // Log error to monitoring service
    console.error('Error caught by boundary:', error, errorInfo);

    // Report the raw error to sentinel
    reportClientError(error, errorInfo.componentStack);

    // Report that user is seeing the error page (sentinel prioritizes these)
    reportErrorBoundaryShown({
      error,
      retryCount: 1,
      maxRetries: 1,
      page: window.location.pathname,
      featureName: this.props.featureName,
      componentStack: errorInfo.componentStack,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Check if autopilot healing might be in progress
    this.checkHealingStatus();
  }

  componentWillUnmount() {
    if (this.healingTimer) clearInterval(this.healingTimer);
    if (this.autoRetryTimer) clearTimeout(this.autoRetryTimer);
  }

  private checkHealingStatus() {
    // In production, show healing UI for 30 seconds then auto-retry
    if (process.env.NODE_ENV === 'production') {
      this.setState({ isHealing: true, healingElapsed: 0 });

      this.healingTimer = setInterval(() => {
        this.setState((prev) => ({ healingElapsed: prev.healingElapsed + 1 }));
      }, 1000);

      // Auto-retry after 30 seconds (time for sentinel to potentially fix)
      this.autoRetryTimer = setTimeout(() => {
        this.setState({ isHealing: false });
        if (this.healingTimer) clearInterval(this.healingTimer);
      }, 30_000);
    }
  }

  handleRetry = () => {
    if (this.healingTimer) clearInterval(this.healingTimer);
    if (this.autoRetryTimer) clearTimeout(this.autoRetryTimer);
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      isHealing: false,
      healingElapsed: 0,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      // Healing UI — shown in production when autopilot might be active
      if (this.state.isHealing) {
        const featureName = this.props.featureName || "this feature";
        return (
          <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md border-primary/30">
              <CardHeader className="text-center">
                <CardTitle className="flex items-center gap-2 text-primary">
                  <Bot className="h-5 w-5" />
                  Autopilot Active
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center space-y-4">
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <p className="text-muted-foreground">
                    I noticed a hiccup in {featureName}. Applying an automated fix — hang tight for {30 - this.state.healingElapsed}s.
                  </p>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5">
                  <div
                    className="bg-primary h-1.5 rounded-full transition-all duration-1000"
                    style={{ width: `${Math.min(100, (this.state.healingElapsed / 30) * 100)}%` }}
                  />
                </div>
                <Button
                  onClick={this.handleRetry}
                  variant="outline"
                  size="sm"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Now
                </Button>
              </CardContent>
            </Card>
          </div>
        );
      }

      // Standard error UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <Card className="w-full max-w-md border-destructive/30">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Something went wrong
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-muted-foreground">
                {this.state.error?.message || 'An unexpected error occurred'}
              </p>

              {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                <details className="mt-4 p-4 bg-destructive/5 rounded border border-destructive/20">
                  <summary className="cursor-pointer font-medium text-destructive">
                    Error Details (Development)
                  </summary>
                  <pre className="mt-2 text-xs text-left overflow-auto">
                    {JSON.stringify(this.state.errorInfo, null, 2)}
                  </pre>
                </details>
              )}

              <div className="flex gap-2 justify-center">
                <Button
                  onClick={this.handleRetry}
                  variant="outline"
                  size="sm"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
                <Button
                  onClick={() => window.location.reload()}
                  variant="default"
                  size="sm"
                >
                  Reload Page
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// reportClientError and global error handlers are now imported from @/lib/reportClientError

// Hook for functional components
export function useErrorHandler() {
  return (error: Error, errorInfo: ErrorInfo) => {
    console.error('Error in functional component:', error, errorInfo);
    reportClientError(error, errorInfo.componentStack);
  };
}

export default EnhancedErrorBoundary;
