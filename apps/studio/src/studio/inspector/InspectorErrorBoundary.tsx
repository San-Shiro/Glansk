import React, { Component, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  resetKey?: unknown;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class InspectorErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("InspectorErrorBoundary caught render error:", error, errorInfo);
  }

  public override componentDidUpdate(prevProps: Props) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 rounded-lg border border-[var(--danger)] bg-[var(--danger-soft)] text-xs flex flex-col gap-2">
          <div className="flex items-center gap-2 font-semibold text-[var(--danger)]">
            <AlertTriangle size={15} className="shrink-0" />
            <span>{this.props.fallbackTitle ?? "Inspector Error"}</span>
          </div>
          <p className="text-[var(--ink-2)] text-[11px] leading-relaxed">
            An unexpected error occurred while rendering this inspector tab.
          </p>
          {this.state.error?.message && (
            <div className="p-2 rounded bg-[var(--panel)] border border-[var(--line)] font-mono text-[10px] text-[var(--ink-2)] overflow-x-auto">
              {this.state.error.message}
            </div>
          )}
          <button
            type="button"
            onClick={this.handleReset}
            className="mt-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded bg-[var(--panel)] border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--line-2)] font-medium transition-colors w-fit"
          >
            <RotateCcw size={12} />
            <span>Retry</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default InspectorErrorBoundary;
