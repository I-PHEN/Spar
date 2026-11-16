import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AuthView } from "./auth-view";

describe("AuthView", () => {
  const markup = renderToStaticMarkup(
    <AuthView onContinue={() => {}} onBack={() => {}} />,
  );

  test("renders Google OAuth and Email/Password sign-in & sign-up toggle", () => {
    expect(markup).toContain("Continue with Google");
    expect(markup).toContain("Sign In");
    expect(markup).toContain("Create Account");
    expect(markup).toContain('id="auth-email"');
    expect(markup).toContain('id="auth-password"');
  });

  test("renders password visibility toggle and avoids fake entry copy", () => {
    expect(markup).toContain("Show password");
    expect(markup).not.toContain("Quick Entry");
    expect(markup).not.toContain("Skip for now");
    expect(markup).not.toContain("Terms and Privacy Policy");
    expect(markup).not.toContain("Sparring Room");
    expect(markup).toContain("Spar");
    expect(markup).toContain("bg-[var(--surface-1)]");
  });

  test("renders recovery mode when recoveryToken is supplied", () => {
    const recoveryMarkup = renderToStaticMarkup(
      <AuthView
        onContinue={() => {}}
        onBack={() => {}}
        recoveryToken="rec-token-123"
      />,
    );
    expect(recoveryMarkup).toContain("Set a new password");
    expect(recoveryMarkup).toContain('id="auth-confirm-password"');
    expect(recoveryMarkup).toContain("Update Password");
  });
});
