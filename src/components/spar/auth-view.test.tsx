import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AuthView } from "./auth-view";

describe("AuthView", () => {
  const markup = renderToStaticMarkup(
    <AuthView onContinue={() => {}} onBack={() => {}} />,
  );

  test("name-only form with associated label and Continue button", () => {
    expect(markup).toContain("Your name");
    expect(markup).toContain("Continue");
    expect(markup).toContain('id="auth-name"');
    expect(markup).toContain('for="auth-name"');
  });

  test("no email input or false Terms line", () => {
    expect(markup).not.toContain("you@example.com");
    expect(markup).not.toContain('type="email"');
    expect(markup).not.toContain("Terms and Privacy Policy");
  });

  test("has a Skip affordance for fast iteration", () => {
    expect(markup).toContain("Skip for now");
  });
});
