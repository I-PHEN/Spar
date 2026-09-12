import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { EXPERIENCE_LIST } from "@/lib/experiences";
import type { ArchitectureManifest } from "./types";

const expectedRoutes = [
  "src/app/api/sessions/route.ts",
  "src/app/api/sessions/[id]/open/route.ts",
  "src/app/api/sessions/[id]/present/route.ts",
  "src/app/api/sessions/[id]/spar-stream/route.ts",
  "src/app/api/sessions/[id]/end/route.ts",
  "src/app/api/sessions/[id]/debrief/route.ts",
];

export function validateManifest(
  manifest: ArchitectureManifest,
  repositoryRoot: string
): string[] {
  const errors: string[] = [];
  const nodeIds = new Set<string>();

  for (const node of manifest.nodes) {
    if (nodeIds.has(node.id)) {
      errors.push(`Duplicate node ID: ${node.id}`);
    }
    nodeIds.add(node.id);
  }

  for (const edge of manifest.edges) {
    if (!nodeIds.has(edge.from)) {
      errors.push(`Unknown edge source: ${edge.from}`);
    }
    if (!nodeIds.has(edge.to)) {
      errors.push(`Unknown edge target: ${edge.to}`);
    }
  }

  for (const tour of manifest.tours) {
    for (const nodeId of tour.nodeIds) {
      if (!nodeIds.has(nodeId)) {
        errors.push(`Unknown tour node: ${nodeId}`);
      }
    }
  }

  const experienceIds = new Set(manifest.experiences.map((experience) => experience.id));
  for (const key of EXPERIENCE_LIST.map((item) => item.key)) {
    if (!experienceIds.has(key)) {
      errors.push(`Missing experience: ${key}`);
    }
  }

  for (const node of manifest.nodes) {
    for (const file of node.files) {
      if (!existsSync(resolve(repositoryRoot, file))) {
        errors.push(`Missing file: ${file}`);
      }
    }
  }

  const criticalRoutes = new Set(manifest.criticalRoutes);
  for (const route of expectedRoutes) {
    if (!criticalRoutes.has(route)) {
      errors.push(`Missing critical route: ${route}`);
    }
  }

  return errors;
}
