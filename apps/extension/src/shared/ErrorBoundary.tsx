import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { message: string };

/**
 * A thrown render is otherwise indistinguishable from a dead surface: React empties the
 * root and the user sees an unexplained blank panel. Keep a readable fallback instead.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { message: "" };

  static getDerivedStateFromError(error: unknown): State {
    return { message: error instanceof Error ? error.message : String(error) };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error("PairProof UI error", error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.message) return this.props.children;
    return (
      <div className="shell shell--popup" role="alert">
        <section className="card status-card">
          <h2>Something broke in this screen</h2>
          <p className="status status--danger">{this.state.message}</p>
          <p className="status">
            Nothing was uploaded. Reload to start again — your account, plan, and Moss User ID stay
            saved on this device.
          </p>
          <button type="button" className="cta" onClick={() => window.location.reload()}>
            Reload
          </button>
        </section>
      </div>
    );
  }
}
