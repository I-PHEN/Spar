import { notFound } from "next/navigation";
import { isArchitectureEnabled } from "@/architecture/access";
import { architectureManifest } from "@/architecture/manifest";
import { ArchitectureExplorer } from "@/components/architecture/architecture-explorer";

export default function ArchitecturePage() {
  if (!isArchitectureEnabled(process.env.NODE_ENV)) notFound();
  return <ArchitectureExplorer manifest={architectureManifest} />;
}
