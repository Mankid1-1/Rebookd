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
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, errorInfo });

    // Log error to monitoring service
    console.error("Error caught by boundary:", error, errorInfo);

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
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
                {this.state.error?.message ||
                  "An unexpected error occurred"}
              </p>

              {process.env.NODE_ENV === "development" && (
                <div className="p-4 w-full rounded bg-muted overflow-auto mb-6">
                  <pre className="text-sm text-muted-foreground whitespace-break-spaces">
                    {this.state.error?.stack}
                  </pre>
                </div>
              )}

              {process.env.NODE_ENV !== "development" && (
                <p className="text-muted-foreground text-sm mb-6">
                  Something went wrong. Please reload the page. If the issue
                  persists, contact support.
                </p>
              )}

              <Button
                onClick={() => window.location.reload()}
                className="w-full"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reload Page
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
