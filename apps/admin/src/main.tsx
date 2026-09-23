import {
  StrictMode,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import {
  createRoot,
} from "react-dom/client";

import "@moss/ui/tokens.css";
import "@moss/ui/typography.css";
import "@moss/ui/interaction.css";

import "./admin.css";

type Tab =
  | "overview"
  | "customers";

type SessionResponse = {
  ok: boolean;
  accessToken?: string;
  refreshToken?: string;
  userId?: string;
  email?: string;
  message?: string;
  status?: number;
  error?: string;
};

type Customer = {
  userId: string;
  email: string;
  emailVerified: boolean;
  createdAt: number;

  plan:
    | "PairProof Pro"
    | "Free";

  status:
    | "active"
    | "refunded"
    | "disputed"
    | "none";

  subscribedAt:
    | number
    | null;

  remaining: number;
  total: number;

  maxFilesPerRun:
    | number
    | null;

  offerVersion:
    | string
    | null;
};

type Dashboard = {
  ok: boolean;

  admin: {
    userId: string;
    email: string;
  };

  generatedAt: number;

  metrics: {
    totalUsers: number;
    verifiedUsers: number;
    paidUsers: number;
    activeSubscriptions: number;
    refundedUsers: number;
    totalRunsRemaining: number;
    totalRunsPurchased: number;
  };

  customers: Customer[];

  plan: {
    name: string;
    priceUsd: number;
    runsIncluded: number;
    maxFilesPerRun: number;
    deviceLimit: number;
    hostedOperabilityMonths: number;
  };
};

const API_ORIGIN =
  import.meta.env
    .VITE_MOSS_API_ORIGIN ||
  "";

const ACCESS_KEY =
  "pairproof.admin.access";

const REFRESH_KEY =
  "pairproof.admin.refresh";

const DEVICE_KEY =
  "pairproof.admin.device";

function getDeviceId(): string {
  const existing =
    localStorage.getItem(
      DEVICE_KEY,
    );

  if (existing) {
    return existing;
  }

  const id =
    crypto.randomUUID();

  localStorage.setItem(
    DEVICE_KEY,
    id,
  );

  return id;
}

function formatDate(
  value:
    | number
    | null,
): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    },
  ).format(value);
}

function relative(
  value: number,
): string {
  const diff =
    Date.now() - value;

  const days =
    Math.max(
      0,
      Math.floor(
        diff /
          86_400_000,
      ),
    );

  if (days === 0) {
    return "Today";
  }

  if (days === 1) {
    return "1 day ago";
  }

  if (days < 30) {
    return `${days} days ago`;
  }

  const months =
    Math.floor(
      days / 30,
    );

  if (months === 1) {
    return "1 month ago";
  }

  return `${months} months ago`;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token =
    localStorage.getItem(
      ACCESS_KEY,
    );

  const headers =
    new Headers(
      options.headers,
    );

  headers.set(
    "Content-Type",
    "application/json",
  );

  if (token) {
    headers.set(
      "Authorization",
      `Bearer ${token}`,
    );
  }

  const response =
    await fetch(
      `${API_ORIGIN}${path}`,
      {
        ...options,
        headers,
      },
    );

  let body: unknown = null;

  try {
    body =
      await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const errorBody =
      body as
        | {
            error?: string;
            message?: string;
          }
        | null;

    throw new Error(
      errorBody?.message ||
        errorBody?.error ||
        `Request failed (${response.status})`,
    );
  }

  return body as T;
}

function clearSession(): void {
  localStorage.removeItem(
    ACCESS_KEY,
  );

  localStorage.removeItem(
    REFRESH_KEY,
  );
}

function Login({
  onAuthenticated,
}: {
  onAuthenticated: (
    email: string,
  ) => void;
}) {
  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState("");

  async function submitLogin(
    event: FormEvent,
  ) {
    event.preventDefault();

    setBusy(true);
    setError("");

    try {
      const result =
        await request<SessionResponse>(
          "/v1/admin/login",
          {
            method: "POST",

            body: JSON.stringify({
              email:
                email.trim(),
              password,
              deviceId:
                getDeviceId(),
            }),
          },
        );

      if (
        !result.accessToken
      ) {
        throw new Error(
          "Admin session could not be created.",
        );
      }

      localStorage.setItem(
        ACCESS_KEY,
        result.accessToken,
      );

      if (
        result.refreshToken
      ) {
        localStorage.setItem(
          REFRESH_KEY,
          result.refreshToken,
        );
      }

      onAuthenticated(
        result.email ||
          email.trim(),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to sign in",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand-lockup">
          <span className="brand-mark">
            P
          </span>

          <div>
            <div className="brand-name">
              PairProof
            </div>

            <div className="brand-kicker">
              Secure Admin
            </div>
          </div>
        </div>

        <div className="auth-heading">
          <span className="eyebrow">
            Secure access
          </span>

          <h1>
            Welcome back
          </h1>

          <p>
            Sign in to manage
            PairProof customers,
            plans, and
            entitlements.
          </p>
        </div>

        <form
          className="auth-form"
          onSubmit={
            submitLogin
          }
        >
          <label>
            <span>
              Email
            </span>

            <input
              value={email}
              onChange={(
                event,
              ) =>
                setEmail(
                  event.target
                    .value,
                )
              }
              type="email"
              required
              autoComplete="username"
              autoFocus
            />
          </label>

          <label>
            <span>
              Password
            </span>

            <input
              value={password}
              onChange={(
                event,
              ) =>
                setPassword(
                  event.target
                    .value,
                )
              }
              type="password"
              required
              autoComplete="current-password"
            />
          </label>

          <button
            className="primary-btn"
            type="submit"
            disabled={busy}
          >
            {busy
              ? "Signing in…"
              : "Sign in"}
          </button>
        </form>

        {error && (
          <div className="notice error">
            {error}
          </div>
        )}
      </section>
    </main>
  );
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-label">
        {label}
      </div>

      <div className="stat-value">
        {value}
      </div>

      <div className="stat-detail">
        {detail}
      </div>
    </div>
  );
}

function StatusPill({
  status,
}: {
  status: Customer["status"];
}) {
  const copy: Record<
    Customer["status"],
    string
  > = {
    active: "Active",
    refunded: "Refunded",
    disputed: "Disputed",
    none: "Free",
  };

  return (
    <span
      className={`status-pill status-${status}`}
    >
      {copy[status]}
    </span>
  );
}

function App() {
  const [email, setEmail] =
    useState<
      string | null
    >(null);

  const [
    dashboard,
    setDashboard,
  ] = useState<
    Dashboard | null
  >(null);

  const [tab, setTab] =
    useState<Tab>(
      "overview",
    );

  const [query, setQuery] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState("");

  async function loadDashboard() {
    setBusy(true);
    setError("");

    try {
      const data =
        await request<Dashboard>(
          "/v1/admin/dashboard",
        );

      setDashboard(data);

      setEmail(
        data.admin.email,
      );
    } catch (err) {
      if (
        err instanceof Error &&
        /unauthorized|admin-required|admin/i.test(
          err.message,
        )
      ) {
        clearSession();

        setEmail(null);
        setDashboard(null);

        return;
      }

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load dashboard",
      );
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const token =
      localStorage.getItem(
        ACCESS_KEY,
      );

    if (token) {
      void loadDashboard();
    }
  }, []);

  const filteredCustomers =
    useMemo(() => {
      const customers =
        dashboard?.customers ||
        [];

      const normalized =
        query
          .trim()
          .toLowerCase();

      if (!normalized) {
        return customers;
      }

      return customers.filter(
        (customer) =>
          [
            customer.email,
            customer.userId,
            customer.plan,
            customer.status,
          ].some((value) =>
            value
              .toLowerCase()
              .includes(
                normalized,
              ),
          ),
      );
    }, [
      dashboard,
      query,
    ]);

  if (!email) {
    return (
      <Login
        onAuthenticated={() =>
          void loadDashboard()
        }
      />
    );
  }

  if (!dashboard) {
    return (
      <main className="app-shell">
        <div className="loading-card">
          {busy
            ? "Loading admin data…"
            : error ||
              "No dashboard data available."}
        </div>
      </main>
    );
  }

  const {
    metrics,
    plan,
  } = dashboard;

  const utilization =
    metrics.totalRunsPurchased
      ? Math.round(
          (
            (
              metrics.totalRunsPurchased -
              metrics.totalRunsRemaining
            ) /
            metrics.totalRunsPurchased
          ) *
            100,
        )
      : 0;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <div className="brand-lockup">
            <span className="brand-mark">
              P
            </span>

            <div>
              <div className="brand-name">
                PairProof
              </div>

              <div className="brand-kicker">
                Admin Console
              </div>
            </div>
          </div>

          <span className="admin-badge">
            ADMIN
          </span>
        </div>

        <div className="topbar-right">
          <div className="account-chip">
            <span className="avatar">
              {email
                .slice(0, 1)
                .toUpperCase()}
            </span>

            <span>
              {email}
            </span>
          </div>

          <button
            className="ghost-btn"
            onClick={() => {
              clearSession();

              setEmail(
                null,
              );

              setDashboard(
                null,
              );
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="content">
        <section className="hero-row">
          <div>
            <span className="eyebrow">
              Operations overview
            </span>

            <h1>
              Customer intelligence
              at a glance
            </h1>

            <p>
              Monitor account
              growth, paid
              coverage,
              entitlement
              status, and
              remaining usage.
            </p>
          </div>

          <div className="hero-actions">
            <span className="sync-meta">
              Updated{" "}
              {relative(
                dashboard.generatedAt,
              )}
            </span>

            <button
              className="secondary-btn"
              onClick={() =>
                void loadDashboard()
              }
              disabled={busy}
            >
              {busy
                ? "Refreshing…"
                : "Refresh"}
            </button>
          </div>
        </section>

        <nav
          className="tabs"
          aria-label="Admin sections"
        >
          <button
            className={
              tab === "overview"
                ? "tab active"
                : "tab"
            }
            onClick={() =>
              setTab(
                "overview",
              )
            }
          >
            Overview
          </button>

          <button
            className={
              tab === "customers"
                ? "tab active"
                : "tab"
            }
            onClick={() =>
              setTab(
                "customers",
              )
            }
          >
            Customers
          </button>
        </nav>

        {tab === "overview" ? (
          <div className="dashboard-grid">
            <section className="metric-grid">
              <StatCard
                label="Total users"
                value={metrics.totalUsers.toLocaleString()}
                detail={`${metrics.verifiedUsers.toLocaleString()} verified`}
              />

              <StatCard
                label="Paid users"
                value={metrics.paidUsers.toLocaleString()}
                detail={`${metrics.activeSubscriptions.toLocaleString()} active`}
              />

              <StatCard
                label="Runs remaining"
                value={metrics.totalRunsRemaining.toLocaleString()}
                detail={`of ${metrics.totalRunsPurchased.toLocaleString()} purchased`}
              />

              <StatCard
                label="Refunded / disputed"
                value={metrics.refundedUsers.toLocaleString()}
                detail="Requires attention"
              />
            </section>

            <section className="panel plan-panel">
              <div className="panel-header">
                <div>
                  <span className="eyebrow">
                    Commercial
                    snapshot
                  </span>

                  <h2>
                    {plan.name}
                  </h2>

                  <p>
                    Current
                    approved
                    customer
                    offer.
                  </p>
                </div>

                <div className="price-tag">
                  $
                  {
                    plan.priceUsd
                  }
                  <span>
                    {" "}
                    one-time
                  </span>
                </div>
              </div>

              <div className="plan-facts">
                <div>
                  <strong>
                    {
                      plan.runsIncluded
                    }
                  </strong>

                  <span>
                    runs
                    included
                  </span>
                </div>

                <div>
                  <strong>
                    {
                      plan.maxFilesPerRun
                    }
                  </strong>

                  <span>
                    files /
                    run
                  </span>
                </div>

                <div>
                  <strong>
                    {
                      plan.deviceLimit
                    }
                  </strong>

                  <span>
                    devices
                  </span>
                </div>

                <div>
                  <strong>
                    {
                      plan.hostedOperabilityMonths
                    }{" "}
                    mo
                  </strong>

                  <span>
                    hosted
                    window
                  </span>
                </div>
              </div>

              <div className="utilization-block">
                <div className="utilization-head">
                  <span>
                    Purchased
                    run
                    utilization
                  </span>

                  <strong>
                    {utilization}%
                  </strong>
                </div>

                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${utilization}%`,
                    }}
                  />
                </div>

                <div className="progress-foot">
                  <span>
                    {metrics.totalRunsPurchased -
                      metrics.totalRunsRemaining}{" "}
                    used
                  </span>

                  <span>
                    {
                      metrics.totalRunsRemaining
                    }{" "}
                    remaining
                  </span>
                </div>
              </div>
            </section>

            <section className="panel recent-panel">
              <div className="panel-header compact">
                <div>
                  <span className="eyebrow">
                    Latest
                    accounts
                  </span>

                  <h2>
                    Recent
                    customers
                  </h2>
                </div>

                <button
                  className="link-btn"
                  onClick={() =>
                    setTab(
                      "customers",
                    )
                  }
                >
                  View all
                </button>
              </div>

              <div className="recent-list">
                {dashboard.customers
                  .slice(
                    0,
                    6,
                  )
                  .map(
                    (
                      customer,
                    ) => (
                      <div
                        className="recent-row"
                        key={
                          customer.userId
                        }
                      >
                        <div className="recent-avatar">
                          {customer.email
                            .slice(
                              0,
                              1,
                            )
                            .toUpperCase()}
                        </div>

                        <div className="recent-main">
                          <strong>
                            {
                              customer.email
                            }
                          </strong>

                          <span>
                            {customer.subscribedAt
                              ? `Subscribed ${formatDate(
                                  customer.subscribedAt,
                                )}`
                              : "No purchase yet"}
                          </span>
                        </div>

                        <StatusPill
                          status={
                            customer.status
                          }
                        />
                      </div>
                    ),
                  )}
              </div>
            </section>

            {metrics.refundedUsers >
              0 && (
              <section className="alert-panel">
                <div className="alert-icon">
                  !
                </div>

                <div>
                  <strong>
                    Review
                    payment
                    exceptions
                  </strong>

                  <p>
                    {
                      metrics.refundedUsers
                    }{" "}
                    account
                    {metrics.refundedUsers ===
                    1
                      ? ""
                      : "s"}{" "}
                    have a
                    refunded
                    or
                    disputed
                    entitlement.
                  </p>
                </div>

                <button
                  className="secondary-btn"
                  onClick={() => {
                    setTab(
                      "customers",
                    );

                    setQuery(
                      "refunded",
                    );
                  }}
                >
                  Review
                </button>
              </section>
            )}
          </div>
        ) : (
          <section className="panel customers-panel">
            <div className="panel-header customers-heading">
              <div>
                <span className="eyebrow">
                  Customer
                  ledger
                </span>

                <h2>
                  All accounts
                </h2>

                <p>
                  Search by
                  email, user
                  id, plan, or
                  entitlement
                  status.
                </p>
              </div>

              <div className="search-wrap">
                <span>
                  ⌕
                </span>

                <input
                  value={query}
                  onChange={(
                    event,
                  ) =>
                    setQuery(
                      event.target
                        .value,
                    )
                  }
                  placeholder="Search customers…"
                />
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>
                      Customer
                    </th>

                    <th>
                      Plan
                    </th>

                    <th>
                      Status
                    </th>

                    <th>
                      Subscribed
                    </th>

                    <th>
                      Usage
                    </th>

                    <th>
                      Joined
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredCustomers.map(
                    (
                      customer,
                    ) => (
                      <tr
                        key={
                          customer.userId
                        }
                      >
                        <td>
                          <div className="customer-cell">
                            <span className="recent-avatar">
                              {customer.email
                                .slice(
                                  0,
                                  1,
                                )
                                .toUpperCase()}
                            </span>

                            <div>
                              <strong>
                                {
                                  customer.email
                                }
                              </strong>

                              <span>
                                {
                                  customer.userId
                                }
                              </span>
                            </div>
                          </div>
                        </td>

                        <td>
                          <span
                            className={
                              customer.plan ===
                              "Free"
                                ? "muted"
                                : "plan-name"
                            }
                          >
                            {
                              customer.plan
                            }
                          </span>

                          {customer.offerVersion && (
                            <small>
                              v
                              {
                                customer.offerVersion
                              }
                            </small>
                          )}
                        </td>

                        <td>
                          <StatusPill
                            status={
                              customer.status
                            }
                          />
                        </td>

                        <td>
                          {formatDate(
                            customer.subscribedAt,
                          )}
                        </td>

                        <td>
                          {customer.total >
                          0 ? (
                            <>
                              <strong>
                                {customer.total -
                                  customer.remaining}
                              </strong>

                              <span className="usage-muted">
                                {" "}
                                /{" "}
                                {
                                  customer.total
                                }{" "}
                                used
                              </span>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>

                        <td>
                          {formatDate(
                            customer.createdAt,
                          )}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>

            {!filteredCustomers.length && (
              <div className="empty-state">
                No customers
                match “
                {query}”.
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

createRoot(
  document.getElementById(
    "root",
  )!,
).render(
  <StrictMode>
    <App />
  </StrictMode>,
);