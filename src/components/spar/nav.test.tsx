import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Nav, ProfileMenuContent } from "./nav";
import { SparLogo } from "./spar-logo";

describe("SparLogo & User Profile Nav", () => {
  test("SparLogo renders the Counter-Blades vector mark standalone without a box wrapper", () => {
    const markup = renderToStaticMarkup(<SparLogo size="md" />);
    expect(markup).toContain('viewBox="0 0 40 40"');
    expect(markup).toContain("#2F65F6");
    expect(markup).toContain("#1D4ED8");
    expect(markup).toContain("#F5F5F7");
    expect(markup).not.toContain("<div");
  });

  test("Nav groups Home and Coach next to a circular Profile button instead of top-level Settings", () => {
    const markup = renderToStaticMarkup(
      <Nav current="home" onNavigate={() => {}} />,
    );
    expect(markup).toContain("Home");
    expect(markup).toContain("Coach");
    expect(markup).toContain("Open user profile menu");
    expect(markup).toContain('title="Account"');
    expect(markup).toContain(">AC<");
    expect(markup).toContain("h-8 w-8 items-center justify-center rounded-full");
    expect(markup).toContain("bg-[#0E0E11]");
    expect(markup).toContain("#2F65F6");
    expect(markup).not.toContain("Settings");
    expect(markup).not.toContain("Progress");
    expect(markup).not.toContain("Sparring Room");
  });

  test("Nav renders a single circular avatar with initials rather than a horizontal name pill", () => {
    const fullNameMarkup = renderToStaticMarkup(
      <Nav
        current="coach"
        onNavigate={() => {}}
        userName="Michael Ayiam"
        userEmail="michael@example.com"
        cloudSyncEnabled
      />,
    );
    expect(fullNameMarkup).toContain('title="Michael Ayiam"');
    expect(fullNameMarkup).toContain(">MA<");
    expect(fullNameMarkup).not.toContain(">Michael Ayiam<");

    const singleNameMarkup = renderToStaticMarkup(
      <Nav current="home" onNavigate={() => {}} userName="Alex" />,
    );
    expect(singleNameMarkup).toContain('title="Alex"');
    expect(singleNameMarkup).toContain(">AL<");
    expect(singleNameMarkup).not.toContain(">Alex<");
  });

  test("ProfileMenuContent renders strictly Settings and Log out without extra submenu shortcuts", () => {
    const markup = renderToStaticMarkup(
      <ProfileMenuContent
        displayName="Michael Ayiam"
        initials="MA"
        subtitle="michael@example.com"
        signingOut={false}
        onSelectTab={() => {}}
        onLogOut={() => {}}
      />,
    );

    expect(markup).toContain("Michael Ayiam");
    expect(markup).toContain("michael@example.com");
    expect(markup).toContain(">Settings<");
    expect(markup).toContain(">Log out<");
    expect(markup.match(/role="menuitem"/g)?.length).toBe(2);
    expect(markup).not.toContain("Room Defaults");
    expect(markup).not.toContain("Voice &amp; Accents");
  });
});
