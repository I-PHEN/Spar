import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SettingsModal, SettingsView } from "./settings-view";

describe("SettingsView / SettingsModal (Claude + ChatGPT two-pane redesign)", () => {
  test("renders solid two-pane layout with left rail search and Account tab by default", () => {
    const markup = renderToStaticMarkup(
      <SettingsView
        userName="Michael"
        onUserUpdated={() => {}}
        onSignOut={() => {}}
      />,
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain("bg-[#141416]");
    expect(markup).toContain("bg-[#1C1C1F]");
    expect(markup).toContain("bg-[#2A2A2E]");
    expect(markup).toContain('aria-label="Search settings"');

    // Left rail tabs
    expect(markup).toContain("Account");
    expect(markup).toContain("Appearance");
    expect(markup).toContain("Room Defaults");
    expect(markup).toContain("Audio &amp; Mic");
    expect(markup).not.toContain("Voice &amp; Accents");

    // Active tab body (Account)
    expect(markup).toContain("Display name");
    expect(markup).toContain("Workspace sync");
    expect(markup).toContain("Local Workspace Only");
    expect(markup).toContain("Log out");

    // Only one category renders in the right pane at once
    expect(markup).not.toContain("Subject domain");
    expect(markup).not.toContain("Microphone level check");

    // Zero fake billing/upgrade or dishonest sync copy
    expect(markup).not.toContain("Connected to Supabase Cloud Sync");
    expect(markup).not.toContain("Primary Use Case");
    expect(markup).not.toContain("Save Preferences");
    expect(markup).not.toContain("Upgrade");
    expect(markup).not.toContain("Billing");
  });

  test("renders honest Supabase sync badges on Account tab", () => {
    const synced = renderToStaticMarkup(
      <SettingsModal
        userName="Michael"
        userEmail="michael@example.com"
        supabaseConfigured
        cloudSyncEnabled
        onUserUpdated={() => {}}
        onSignOut={() => {}}
      />,
    );
    expect(synced).toContain("michael@example.com");
    expect(synced).toContain("Cloud Sync Active");

    const localSession = renderToStaticMarkup(
      <SettingsModal
        userName="Tester"
        supabaseConfigured
        cloudSyncEnabled={false}
        onUserUpdated={() => {}}
        onSignOut={() => {}}
      />,
    );
    expect(localSession).toContain("Local Session");
  });

  test("renders Appearance tab with display Accent color swatches and live preview", () => {
    const markup = renderToStaticMarkup(
      <SettingsModal
        initialTab="appearance"
        userName="Michael"
        onUserUpdated={() => {}}
        onSignOut={() => {}}
      />,
    );

    expect(markup).toContain("Accent color");
    expect(markup).toContain('role="radiogroup"');
    expect(markup).toContain("Default");
    expect(markup).toContain("Blue");
    expect(markup).toContain("Green");
    expect(markup).toContain("Yellow");
    expect(markup).toContain("Pink");
    expect(markup).toContain("Orange");
    expect(markup).toContain("Live accent preview");
    expect(markup).not.toContain("Spoken accent");
    expect(markup).not.toContain("Mixed International Panel");
  });

  test("renders Room Defaults tab with domain, mode, and panel intensity rows", () => {
    const markup = renderToStaticMarkup(
      <SettingsModal
        initialTab="defaults"
        userName="Michael"
        onUserUpdated={() => {}}
        onSignOut={() => {}}
      />,
    );

    expect(markup).toContain("Subject domain");
    expect(markup).toContain("Default mode");
    expect(markup).toContain("Q&amp;A");
    expect(markup).toContain("Drill");
    expect(markup).toContain("Panel intensity");
    expect(markup).toContain("Gentle");
    expect(markup).toContain("Moderate");
    expect(markup).toContain("Aggressive");
  });

  test("renders Audio & Mic tab with voice tone, switches, chime test, and live microphone meter", () => {
    const markup = renderToStaticMarkup(
      <SettingsModal
        initialTab="audio"
        userName="Michael"
        onUserUpdated={() => {}}
        onSignOut={() => {}}
      />,
    );

    expect(markup).toContain("Voice tone");
    expect(markup).toContain("Authoritative");
    expect(markup).toContain("Warm");
    expect(markup).toContain("Crisp");
    expect(markup).toContain("Hands-free auto-mic");
    expect(markup).toContain("Live drill buzzer sound");
    expect(markup).toContain("Test chime");
    expect(markup).toContain("Microphone level check");
    expect(markup).toContain("Test Microphone");
  });

  test("renders nothing when open is false", () => {
    const markup = renderToStaticMarkup(
      <SettingsModal
        open={false}
        userName="Michael"
        onUserUpdated={() => {}}
        onSignOut={() => {}}
      />,
    );
    expect(markup).toBe("");
  });
});
