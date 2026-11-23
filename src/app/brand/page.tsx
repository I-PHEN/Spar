import { notFound } from "next/navigation";
import { isArchitectureEnabled } from "@/architecture/access";
import { BrandPreview } from "@/components/spar/brand-preview";

export default function BrandPage() {
  if (!isArchitectureEnabled(process.env.NODE_ENV)) notFound();
  return <BrandPreview />;
}
