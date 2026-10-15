import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PersonaCard } from "./persona-card";

describe("PersonaCard", () => {
  const markup = renderToStaticMarkup(
    <PersonaCard archetype="skeptic" name="Ada" state="idle" mood="neutral" />,
  );

  test("renders name and the one line", () => {
    expect(markup).toContain("Ada");
    expect(markup).toContain("Questions your core assumptions");
    expect(markup).toContain("Listening");
  });

  test("no behavior badge and no interrupt meter", () => {
    for (const badge of ["Gentle", "Moderate", "Aggressive"]) {
      expect(markup).not.toContain(`>${badge}<`);
    }
    expect(markup).not.toContain("h-1 flex-1 rounded-full"); // meter dot bars
  });
});
