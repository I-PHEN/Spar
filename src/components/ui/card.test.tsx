import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card";

describe("Card", () => {
  test("renders single-surface matte card slots cleanly without double wrappers or radial glows", () => {
    const markup = renderToStaticMarkup(
      <Card className="border-[#232327] bg-[#151518] p-5 shadow-none">
        <CardHeader className="p-0">
          <CardTitle>New session</CardTitle>
          <CardDescription>Choose a scenario.</CardDescription>
          <CardAction>Ready</CardAction>
        </CardHeader>
        <CardFooter className="p-0">
          <button type="button">Start setup</button>
        </CardFooter>
      </Card>,
    );

    expect(markup).toContain('data-slot="card"');
    expect(markup).toContain('data-slot="card-header"');
    expect(markup).toContain('data-slot="card-footer"');
    expect(markup).toContain("bg-[#151518]");
    expect(markup).toContain("border-[#232327]");
    expect(markup).not.toContain('data-slot="card-frame"');
    expect(markup).not.toContain("radial-gradient");
  });
});
