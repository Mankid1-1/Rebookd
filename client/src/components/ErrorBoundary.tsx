import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { reportClientError, reportErrorBoundaryShown, initGlobalErrorHandlers } from "@/lib/reportClientError";
import { initDeadClickDetector } from "@/lib/deadClickDetector";
import { initVisualAnomalyDetector } from "@/lib/visualAnomalyDetector";
import { initPerformanceMonitor } from "@/lib/performanceMonitor";
import { initJourneyTracker } from "@/lib/journeyTracker";
import { initAdoptionTracker } from "@/lib/adoptionTracker";
import { initThemeIntegrityChecker } from "@/lib/themeIntegrityChecker";

// Ensure global error handlers and sentinel detectors are registered once
initGlobalErrorHandlers();
initDeadClickDetector();
initVisualAnomalyDetector();
initPerformanceMonitor();
initJourneyTracker();
initAdoptionTracker();
initThemeIntegrityChecker();

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null, retryCount: 0 };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const nextRetry = this.state.retryCount + 1;
    this.setState(prevState => ({
      error,
      errorInfo,
      retryCount: prevState.retryCount + 1
    }));

    // Log error to monitoring service (redacted in production)
    if (process.env.NODE_ENV === 'development') {
      console.error('Error caught by boundary:', error, errorInfo);
    } else {
      console.error('Error caught by boundary:', error.message, error.name);
    }

    // Report the raw error to sentinel
    reportClientError(error, errorInfo.componentStack);

    // Report that user is seeing the "Something went wrong" error page
    reportErrorBoundaryShown({
      error,
      retryCount: nextRetry,
      maxRetries: 3,
      page: window.location.pathname,
      componentStack: errorInfo.componentStack,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      const maxRetries = 3;
      const canRetry = this.state.retryCount <= maxRetries;
      
      return this.props.fallback || (
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
                {canRetry 
                  ? "An unexpected error occurred. Please try again."
                  : "A persistent error occurred. Please contact support if the problem continues."
                }
              </p>

              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="text-left">
                  <summary className="cursor-pointer text-sm font-mono text-muted-foreground hover:text-foreground">
                    Error Details (Attempt {this.state.retryCount})
                  </summary>
                  <pre className="mt-2 text-xs overflow-auto bg-muted p-2 rounded">
                    {this.state.error.toString()}
                    {this.state.errorInfo && (
                      <div className="mt-2">
                        <strong>Component Stack:</strong>
                        <pre className="whitespace-pre-wrap">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </div>
                    )}
                  </pre>
                </details>
              )}

              {canRetry ? (
                <Button onClick={this.handleRetry} className="w-full">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Try Again ({maxRetries - this.state.retryCount + 1} attempts left)
                </Button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Maximum retry attempts reached. This appears to be a persistent issue.
                  </p>
                  <Button onClick={() => window.location.reload()} variant="outline" className="w-full">
                    Reload Page
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export { ErrorBoundary };
