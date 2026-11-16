"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  MailCheck,
  RefreshCw,
} from "lucide-react";
import { SparLogo } from "./spar-logo";
import {
  getSupabaseConfig,
  getSupabaseGoogleOAuthUrl,
  parseSupabaseHashError,
  parseSupabaseQueryCallback,
  requestSupabasePasswordReset,
  resendSupabaseSignupEmail,
  signInWithSupabasePassword,
  signUpWithSupabasePassword,
  updateSupabasePassword,
} from "@/lib/supabase";

interface AuthViewProps {
  onContinue: (name?: string, hasCompletedOnboarding?: boolean) => void;
  onBack: () => void;
  initialError?: string | null;
  recoveryToken?: string | null;
  onRecoveryComplete?: () => void;
}

type AuthMode = "signin" | "signup" | "confirm" | "forgot" | "reset";

const RESEND_COOLDOWN_SEC = 30;

/**
 * Authentication entry — Supabase Google OAuth + Email/Password, email
 * confirmation resend, and password recovery.
 */
export function AuthView({
  onContinue,
  onBack,
  initialError = null,
  recoveryToken = null,
  onRecoveryComplete,
}: AuthViewProps) {
  const [mode, setMode] = useState<AuthMode>(recoveryToken ? "reset" : "signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pendingConfirmEmail, setPendingConfirmEmail] = useState("");
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [notice, setNotice] = useState<string | null>(null);

  const supabaseCfg = getSupabaseConfig();
  const trimmedName = name.trim();
  const redirectOrigin =
    typeof window !== "undefined" ? window.location.origin : undefined;

  useEffect(() => {
    if (recoveryToken) {
      setMode("reset");
      setError(null);
      setNotice(null);
    }
  }, [recoveryToken]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const queryError = parseSupabaseQueryCallback(window.location.search)?.error;
    const hashError = parseSupabaseHashError(window.location.hash);
    const urlError = queryError || hashError;
    if (urlError) {
      setError(urlError);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  async function persistServerSession(payload: {
    accessToken?: string;
    email?: string;
    name?: string;
  }): Promise<{ name?: string; hasCompletedOnboarding?: boolean }> {
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      user?: { name?: string; hasCompletedOnboarding?: boolean };
    };
    if (!res.ok) {
      throw new Error(data.error || "Could not start your session");
    }
    return {
      name: data.user?.name || payload.name,
      hasCompletedOnboarding: data.user?.hasCompletedOnboarding,
    };
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError(null);
    setNotice(null);
    setUnconfirmedEmail(null);
  }

  async function handleGoogleAuth() {
    setError(null);
    setNotice(null);
    if (!supabaseCfg.configured) {
      setNotice(
        "Google sign-in activates once Supabase credentials are configured. Sign in with your email below.",
      );
      return;
    }

    const oauthUrl = getSupabaseGoogleOAuthUrl(redirectOrigin ?? "");
    if (oauthUrl && typeof window !== "undefined") {
      setGoogleLoading(true);
      window.location.href = oauthUrl;
    }
  }

  async function handleResendConfirmation(targetEmail: string) {
    const clean = targetEmail.trim().toLowerCase();
    if (!clean || resending || resendCooldown > 0) return;

    setError(null);
    setNotice(null);
    setResending(true);
    try {
      await resendSupabaseSignupEmail(clean, redirectOrigin);
      setResendCooldown(RESEND_COOLDOWN_SEC);
      setNotice(`Verification link re-sent to ${clean}. Check your inbox and spam folder.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not resend confirmation email.",
      );
    } finally {
      setResending(false);
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setUnconfirmedEmail(null);

    if (mode === "reset") {
      if (password.length < 6) {
        setError("New password must be at least 6 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
      if (!recoveryToken) {
        setError("Your recovery link has expired. Request a new password reset.");
        return;
      }

      setLoading(true);
      try {
        const updatedUser = await updateSupabasePassword(recoveryToken, password);
        const sessionUser = await persistServerSession({
          accessToken: recoveryToken,
          name: updatedUser?.name,
        });
        onRecoveryComplete?.();
        onContinue(sessionUser.name, sessionUser.hasCompletedOnboarding);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not update password.",
        );
      } finally {
        setLoading(false);
      }
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }

    if (mode === "forgot") {
      if (!supabaseCfg.configured) {
        setNotice("Password reset emails require Supabase authentication.");
        return;
      }
      setLoading(true);
      try {
        await requestSupabasePasswordReset(cleanEmail, redirectOrigin);
        setNotice(
          `If an account exists for ${cleanEmail}, a password reset link is on its way.`,
        );
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not send reset email.",
        );
      } finally {
        setLoading(false);
      }
      return;
    }

    if (supabaseCfg.configured && password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      if (supabaseCfg.configured) {
        if (mode === "signup") {
          const result = await signUpWithSupabasePassword(
            cleanEmail,
            password,
            trimmedName || undefined,
            redirectOrigin,
          );
          if (result.needsConfirmation) {
            setPendingConfirmEmail(cleanEmail);
            setResendCooldown(RESEND_COOLDOWN_SEC);
            setMode("confirm");
            return;
          }
          const sessionUser = await persistServerSession({
            accessToken: result.accessToken,
            name: result.user.name || trimmedName || undefined,
          });
          onContinue(sessionUser.name, sessionUser.hasCompletedOnboarding);
          return;
        }

        const result = await signInWithSupabasePassword(cleanEmail, password);
        const sessionUser = await persistServerSession({
          accessToken: result.accessToken,
          name: result.user.name,
        });
        onContinue(sessionUser.name, sessionUser.hasCompletedOnboarding);
        return;
      }

      // Local fallback when Supabase env vars aren't configured
      const sessionUser = await persistServerSession({
        email: cleanEmail,
        name: trimmedName || cleanEmail.split("@")[0],
      });
      onContinue(sessionUser.name, sessionUser.hasCompletedOnboarding);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Authentication failed.";
      if (msg.toLowerCase().includes("email not confirmed")) {
        setUnconfirmedEmail(cleanEmail);
        setError("Your email address is not confirmed yet.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  const cardHeading =
    mode === "signup"
      ? "Create your Spar account"
      : mode === "confirm"
        ? "Check your inbox"
        : mode === "forgot"
          ? "Reset your password"
          : mode === "reset"
            ? "Set a new password"
            : "Sign in to Spar";

  const cardSubheading =
    mode === "signup"
      ? "Save your sparring sessions, preferences, and coaching debriefs."
      : mode === "confirm"
        ? `We sent a confirmation link to ${pendingConfirmEmail || "your email"}.`
        : mode === "forgot"
          ? "Enter your email and we will send a one-click recovery link."
          : mode === "reset"
            ? "Choose a new password with at least 6 characters."
            : "Pick up where you left off with your panel history and settings.";

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-[var(--bg-base)] px-4 py-12 text-[var(--text-primary)]">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <SparLogo size="md" />
          <span className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
            Spar
          </span>
        </div>

        <div className="rounded-xl border border-[#232327] bg-[var(--surface-1)] p-7 sm:p-8">
          <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
            {cardHeading}
          </h1>
          <p className="mt-1 mb-6 text-sm leading-relaxed text-[var(--text-secondary)]">
            {cardSubheading}
          </p>

          {mode === "confirm" ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-text)]">
                  <MailCheck className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 text-xs leading-relaxed text-[var(--text-secondary)]">
                  Open the verification email sent to{" "}
                  <span className="font-medium text-[var(--text-primary)]">
                    {pendingConfirmEmail}
                  </span>{" "}
                  and click the link to activate your account. Check Spam or
                  Promotions if you do not see it within a minute.
                </div>
              </div>

              {notice && (
                <p className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                  {notice}
                </p>
              )}

              {error && (
                <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  {error}
                </p>
              )}

              <button
                type="button"
                onClick={() => void handleResendConfirmation(pendingConfirmEmail)}
                disabled={resending || resendCooldown > 0}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-2)] text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[#22222C] disabled:opacity-55"
              >
                {resending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                <span>
                  {resendCooldown > 0
                    ? `Resend email in ${resendCooldown}s`
                    : "Resend verification email"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEmail(pendingConfirmEmail);
                  switchMode("signin");
                }}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] text-sm font-medium text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)]"
              >
                <span>I&apos;ve confirmed — Sign In</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              {(mode === "signin" || mode === "signup") && (
                <>
                  <button
                    type="button"
                    onClick={handleGoogleAuth}
                    disabled={loading || googleLoading}
                    className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-2)] text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[#22222C] disabled:opacity-60"
                  >
                    {googleLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Connecting to Google...</span>
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            fill="currentColor"
                            d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z"
                          />
                        </svg>
                        <span>Continue with Google</span>
                      </>
                    )}
                  </button>

                  <div className="my-5 flex items-center gap-3">
                    <span className="h-px flex-1 bg-[var(--border-subtle)]" />
                    <span className="text-[11px] uppercase tracking-wider text-[var(--text-tertiary)]">
                      or continue with email
                    </span>
                    <span className="h-px flex-1 bg-[var(--border-subtle)]" />
                  </div>

                  <div className="mb-4 grid grid-cols-2 gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-1">
                    <button
                      type="button"
                      onClick={() => switchMode("signin")}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        mode === "signin"
                          ? "bg-[var(--surface-2)] text-[var(--text-primary)]"
                          : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                      }`}
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => switchMode("signup")}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        mode === "signup"
                          ? "bg-[var(--surface-2)] text-[var(--text-primary)]"
                          : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                      }`}
                    >
                      Create Account
                    </button>
                  </div>
                </>
              )}

              {notice && (
                <p className="mb-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                  {notice}
                </p>
              )}

              {error && (
                <div className="mb-3 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2.5 text-xs text-red-300">
                  <p>{error}</p>
                  {unconfirmedEmail && (
                    <button
                      type="button"
                      onClick={() => void handleResendConfirmation(unconfirmedEmail)}
                      disabled={resending || resendCooldown > 0}
                      className="mt-2 inline-flex items-center gap-1.5 font-medium text-white underline underline-offset-4 hover:text-neutral-200 disabled:opacity-60"
                    >
                      <RefreshCw className="h-3 w-3" />
                      {resendCooldown > 0
                        ? `Resend available in ${resendCooldown}s`
                        : "Resend verification email"}
                    </button>
                  )}
                </div>
              )}

              <form onSubmit={(e) => void handleEmailSubmit(e)} className="space-y-3.5">
                {mode === "signup" && (
                  <div>
                    <label
                      htmlFor="auth-name"
                      className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-[var(--text-secondary)]"
                    >
                      Your name
                    </label>
                    <input
                      id="auth-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="How the panel addresses you"
                      className="h-11 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--border-strong)] focus:outline-none"
                    />
                  </div>
                )}

                {mode !== "reset" && (
                  <div>
                    <label
                      htmlFor="auth-email"
                      className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-[var(--text-secondary)]"
                    >
                      Email
                    </label>
                    <input
                      id="auth-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@domain.com"
                      autoFocus
                      className="h-11 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--border-strong)] focus:outline-none"
                    />
                  </div>
                )}

                {(mode === "signin" || mode === "signup" || mode === "reset") && (
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label
                        htmlFor="auth-password"
                        className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-secondary)]"
                      >
                        {mode === "reset" ? "New password" : "Password"}
                      </label>
                      {mode === "signin" && supabaseCfg.configured && (
                        <button
                          type="button"
                          onClick={() => switchMode("forgot")}
                          className="text-[11px] font-medium text-[var(--accent-text)] transition-colors hover:opacity-80"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        id="auth-password"
                        type={showPassword ? "text" : "password"}
                        required={supabaseCfg.configured || mode === "reset"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={
                          supabaseCfg.configured || mode === "reset"
                            ? "At least 6 characters"
                            : "Optional in local mode"
                        }
                        className="h-11 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] pl-3.5 pr-10 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--border-strong)] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-secondary)]"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {mode === "reset" && (
                  <div>
                    <label
                      htmlFor="auth-confirm-password"
                      className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-[var(--text-secondary)]"
                    >
                      Confirm new password
                    </label>
                    <input
                      id="auth-confirm-password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter your new password"
                      className="h-11 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--border-strong)] focus:outline-none"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || googleLoading}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#F5F5F7] text-sm font-semibold text-[#0A0A0E] transition-colors hover:bg-white disabled:opacity-60"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      {mode === "signup"
                        ? "Create Account"
                        : mode === "forgot"
                          ? "Send Reset Link"
                          : mode === "reset"
                            ? "Update Password"
                            : "Sign In"}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>

                {(mode === "forgot" || mode === "reset") && (
                  <button
                    type="button"
                    onClick={() => {
                      onRecoveryComplete?.();
                      switchMode("signin");
                    }}
                    className="flex w-full items-center justify-center pt-1 text-xs font-medium text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-secondary)]"
                  >
                    Back to Sign In
                  </button>
                )}
              </form>
            </>
          )}
        </div>

        <button
          onClick={onBack}
          className="mt-6 flex w-full items-center justify-center gap-1.5 text-xs text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-secondary)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to home
        </button>
      </div>
    </div>
  );
}
