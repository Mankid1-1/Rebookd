import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
  previousPath: string;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, retryCount: 0, previousPath: '/dashboard' };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState(prevState => ({
      error,
      errorInfo,
      retryCount: prevState.retryCount + 1,
    }));

    if (process.env.NODE_ENV === 'development') {
      console.error('Error caught by boundary:', error, errorInfo);
    } else {
      console.error('Error caught by boundary:', error.message, error.name);
    }

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    // Reload the page for a clean retry rather than re-rendering the same broken tree
    window.location.reload();
  };

  handleGoBack = () => {
    // Go back to last working page, or fallback to dashboard
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/dashboard';
    }
  };

  render() {
    if (this.state.hasError) {
      const maxRetries = 3;
      const attemptsLeft = maxRetries - this.state.retryCount + 1;
      const canRetry = attemptsLeft > 0;

      return this.props.fallback || (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <Card className="w-full max-w-md border-red-200">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                Something went wrong
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-muted-foreground">
                {canRetry
                  ? "An unexpected error occurred. Please try again."
                  : "This page keeps failing. Going back to where you were."}
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
                  Try Again ({attemptsLeft} attempt{attemptsLeft !== 1 ? 's' : ''} left)
                </Button>
              ) : (
                <Button onClick={this.handleGoBack} className="w-full">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Go Back
                </Button>
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
