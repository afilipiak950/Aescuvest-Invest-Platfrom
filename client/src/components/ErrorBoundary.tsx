import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error?: Error; resetError: () => void }>;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private resetTimeoutId: number | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    console.error('🚨 ErrorBoundary caught error:', error);
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🚨 ErrorBoundary componentDidCatch:', {
      error,
      errorInfo,
      componentStack: errorInfo.componentStack,
      errorBoundary: 'DueDiligenceErrorBoundary'
    });

    this.setState({
      error,
      errorInfo,
    });

    // Auto-recovery attempt after 10 seconds
    this.resetTimeoutId = window.setTimeout(() => {
      console.log('🔄 ErrorBoundary attempting auto-recovery...');
      this.resetError();
    }, 10000);
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  resetError = () => {
    console.log('🔄 ErrorBoundary resetting error state...');
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = null;
    }
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
    });
  };

  render() {
    if (this.state.hasError) {
      const { fallback: Fallback } = this.props;

      if (Fallback) {
        return <Fallback error={this.state.error} resetError={this.resetError} />;
      }

      return (
        <div className="container mx-auto px-4 py-6">
          <Card className="bg-red-900/20 border-red-500">
            <CardContent className="py-12 text-center">
              <AlertTriangle className="h-16 w-16 text-red-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2 text-red-400">
                Application Error Detected
              </h3>
              <p className="text-gray-300 mb-2">
                A component error occurred in the Due Diligence analysis.
              </p>
              <p className="text-gray-400 text-sm mb-6">
                Error: {this.state.error?.message || 'Unknown error'}
              </p>
              <div className="flex gap-3 justify-center">
                <Button 
                  onClick={this.resetError}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Try Again
                </Button>
                <Button 
                  onClick={() => window.location.reload()} 
                  className="bg-red-600 hover:bg-red-700"
                >
                  Refresh Page
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

export default ErrorBoundary;