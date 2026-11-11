import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError, type ErrorReport } from './reportError';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  report: ErrorReport | null;
  error: unknown;
}

/**
 * Last line of defence: if a screen crashes, show a friendly page instead of a blank one.
 * Developers see the technical details only in development builds.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { report: null, error: null };

  static getDerivedStateFromError(error: unknown): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    const report = reportError(error, `show the screen${info.componentStack ? ' (render crash)' : ''}`);
    this.setState({ report });
  }

  render() {
    if (this.state.error === null) return this.props.children;
    const { report, error } = this.state;
    return (
      <main id="main" className="app-message crash-screen">
        <h1>Sorry, something went wrong</h1>
        <p>The page ran into a problem. Your saved documents are safe. Reloading usually fixes it.</p>
        {report?.reference && (
          <p className="field-hint">
            If it keeps happening, contact support and mention reference <strong>{report.reference}</strong>.
          </p>
        )}
        <button type="button" className="button-primary" onClick={() => window.location.reload()}>
          Reload the page
        </button>
        {import.meta.env.DEV && (
          <details className="dev-details">
            <summary>Developer details (only shown in development)</summary>
            <pre>{error instanceof Error ? `${error.message}\n\n${error.stack ?? ''}` : String(error)}</pre>
          </details>
        )}
      </main>
    );
  }
}
