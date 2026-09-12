export function isArchitectureEnabled(nodeEnv: string | undefined): boolean {
  return nodeEnv === "development";
}
