import { isArchitectureEnabled } from "@/architecture/access";
import {
  summarizeMetrics,
  type TurnMetricView,
} from "@/architecture/metrics";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

export async function GET() {
  if (!isArchitectureEnabled(process.env.NODE_ENV)) {
    return new Response(null, {
      status: 404,
      headers: NO_STORE_HEADERS,
    });
  }

  const turns: TurnMetricView[] = [];

  return Response.json(
    { turns, summary: summarizeMetrics(turns) },
    { headers: NO_STORE_HEADERS },
  );
}
