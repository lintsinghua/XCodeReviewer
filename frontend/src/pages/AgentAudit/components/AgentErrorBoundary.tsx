/**
 * Agent Error Boundary Component
 * Specialized error boundary for Agent Audit pages with retry and recovery
 */

import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Terminal, ArrowLeft, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/shared/utils/utils';

interface Props {
  children: ReactNode;
  taskId?: string;
  onRetry?: () => void;
  onReset?: () => void;
  maxRetries?: number;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  retryCount: number;
  isRetrying: boolean;
}

export class AgentErrorBoundary extends Component<Props, State> {
  private retryTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      isRetrying: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[AgentErrorBoundary] Caught error:', error, errorInfo);
    this.setState({ errorInfo });

    // Report error to monitoring (placeholder for actual implementation)
    this.reportError(error, errorInfo);
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  private reportError(error: Error, errorInfo: React.ErrorInfo) {
    // Structured error report
    const report = {
      timestamp: new Date().toISOString(),
      taskId: this.props.taskId,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      componentStack: errorInfo.componentStack,
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    // Log locally for development
    if (import.meta.env.DEV) {
      console.error('[AgentErrorBoundary] Error Report:', report);
    }

    // Future: send to error tracking service
  }

  private getErrorCategory(): 'network' | 'stream' | 'render' | 'unknown' {
    const message = this.state.error?.message?.toLowerCase() || '';

    if (message.includes('fetch') || message.includes('network') || message.includes('connection')) {
      return 'network';
    }
    if (message.includes('stream') || message.includes('sse') || message.includes('eventsource')) {
      return 'stream';
    }
    if (message.includes('render') || message.includes('react') || message.includes('component')) {
      return 'render';
    }
    return 'unknown';
  }

  private getRecoveryHint(): string {
    const category = this.getErrorCategory();
    switch (category) {
      case 'network':
        return 'Check your network connection and try again';
      case 'stream':
        return 'The live connection was interrupted. Refresh to reconnect';
      case 'render':
        return 'A display error occurred. Try refreshing the page';
      default:
        return 'An unexpected error occurred';
    }
  }

  handleRetry = async () => {
    const maxRetries = this.props.maxRetries ?? 3;

    if (this.state.retryCount >= maxRetries) {
      return;
    }

    this.setState({ isRetrying: true });

    // Exponential backoff delay
    const delay = Math.min(1000 * Math.pow(2, this.state.retryCount), 10000);

    await new Promise(resolve => {
      this.retryTimeoutId = setTimeout(resolve, delay);
    });

    this.setState(prev => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prev.retryCount + 1,
      isRetrying: false,
    }));

    this.props.onRetry?.();
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      isRetrying: false,
    });
    this.props.onReset?.();
  };

  handleGoBack = () => {
    window.history.back();
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    const { hasError, error, errorInfo, retryCount, isRetrying } = this.state;
    const maxRetries = this.props.maxRetries ?? 3;
    const canRetry = retryCount < maxRetries;
    const category = this.getErrorCategory();

    if (!hasError) {
      return this.props.children;
    }

    return (
      <div className="h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
        <div className="w-full max-w-lg space-y-6">
          {/* Error Header */}
          <div className="flex items-center gap-4">
            <div className={cn(
              "p-3 rounded-lg",
              category === 'network' ? 'bg-yellow-500/10' : 'bg-red-500/10'
            )}>
              <AlertTriangle className={cn(
                "w-8 h-8",
                category === 'network' ? 'text-yellow-400' : 'text-red-400'
              )} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Agent Error</h2>
              <p className="text-sm text-gray-400">{this.getRecoveryHint()}</p>
            </div>
          </div>

          {/* Error Details */}
          <div className="bg-[#0d0d12] border border-gray-800 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-gray-500" />
              <span className="text-xs text-gray-500 uppercase tracking-wider font-bold">
                Error Details
              </span>
            </div>
            <div className="p-4 space-y-3">
              {error && (
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <Bug className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-mono text-red-400">{error.name}</p>
                      <p className="text-sm text-gray-300">{error.message}</p>
                    </div>
                  </div>
                </div>
              )}

              {this.props.taskId && (
                <div className="text-xs text-gray-500">
                  Task ID: <span className="font-mono text-gray-400">{this.props.taskId}</span>
                </div>
              )}

              {retryCount > 0 && (
                <div className="text-xs text-gray-500">
                  Retry attempts: <span className="text-yellow-400">{retryCount}/{maxRetries}</span>
                </div>
              )}

              {/* Stack trace (dev only) */}
              {import.meta.env.DEV && error?.stack && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-gray-500 hover:text-gray-300 transition-colors">
                    Stack Trace
                  </summary>
                  <pre className="mt-2 p-3 bg-black/50 rounded text-[10px] text-gray-400 overflow-auto max-h-40">
                    {error.stack}
                  </pre>
                </details>
              )}

              {import.meta.env.DEV && errorInfo?.componentStack && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-gray-500 hover:text-gray-300 transition-colors">
                    Component Stack
                  </summary>
                  <pre className="mt-2 p-3 bg-black/50 rounded text-[10px] text-gray-400 overflow-auto max-h-40">
                    {errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            {canRetry && (
              <Button
                onClick={this.handleRetry}
                disabled={isRetrying}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                <RefreshCw className={cn("w-4 h-4 mr-2", isRetrying && "animate-spin")} />
                {isRetrying ? 'Retrying...' : 'Retry'}
              </Button>
            )}
            <Button
              onClick={this.handleGoBack}
              variant="outline"
              className="flex-1 border-gray-700 hover:bg-gray-800"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
            <Button
              onClick={this.handleReload}
              variant="ghost"
              className="flex-1 text-gray-400 hover:text-white"
            >
              Refresh Page
            </Button>
          </div>

          {/* Recovery suggestion */}
          {!canRetry && (
            <p className="text-center text-xs text-gray-500">
              Maximum retry attempts reached. Please refresh the page or contact support.
            </p>
          )}
        </div>
      </div>
    );
  }
}

export default AgentErrorBoundary;
