import { notFound } from "next/navigation";
import { isArchitectureEnabled } from "@/architecture/access";

export default function ArchitecturePage() {
  if (!isArchitectureEnabled(process.env.NODE_ENV)) notFound();
  return <main><h1>Spar architecture</h1></main>;
}
