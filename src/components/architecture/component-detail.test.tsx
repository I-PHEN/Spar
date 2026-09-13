/// <reference types="bun-types" />

import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { ArchitectureNode } from "@/architecture/types";
import { ComponentDetail } from "./component-detail";

const node: ArchitectureNode = {
  id: "session-api",
  label: "Session API",
  layer: "api",
  purpose: "Owns the server session boundary.",
  inputs: ["Browser request"],
  outputs: ["Session response"],
  files: ["src/app/api/sessions/route.ts"],
  failure: "The request returns an error.",
};

test("keeps important files in a closed native disclosure", () => {
  const markup = renderToStaticMarkup(<ComponentDetail node={node} />);

  expect(markup).toContain("<details");
  expect(markup).not.toMatch(/<details\b[^>]*\sopen(?:=|\s|>)/);
  expect(markup).toContain(">Important files</summary>");
  expect(markup).toContain("src/app/api/sessions/route.ts");
});
