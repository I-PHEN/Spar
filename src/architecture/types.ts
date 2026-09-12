export type ArchitectureLayer =
  | "browser"
  | "api"
  | "domain"
  | "provider"
  | "storage";

export interface ArchitectureNode {
  id: string;
  label: string;
  layer: ArchitectureLayer;
  purpose: string;
  inputs: string[];
  outputs: string[];
  files: string[];
  failure: string;
  analogy?: string;
}

export interface ArchitectureEdge {
  from: string;
  to: string;
  label: string;
}

export interface FlowStep {
  id: string;
  label: string;
  kind: "user" | "code" | "ai" | "storage";
}

export interface ExperienceFlow {
  id: "defense" | "boardroom" | "open_spar" | "drill";
  summary: string;
  steps: FlowStep[];
}

export interface GuidedTour {
  id: string;
  label: string;
  nodeIds: string[];
}

export interface ArchitectureManifest {
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  experiences: ExperienceFlow[];
  tours: GuidedTour[];
  criticalRoutes: string[];
}
