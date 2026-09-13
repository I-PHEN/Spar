import { isArchitectureEnabled } from "@/architecture/access";
import { db } from "@/lib/db";
import {
  summarizeTurnMetrics,
  type TurnMetricRecord,
} from "@/lib/observability/turn-metrics";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

const metricDb = db as unknown as {
  turnMetric: {
    findMany(args: {
      orderBy: { updatedAt: "desc" };
      take: number;
    }): Promise<TurnMetricRecord[]>;
  };
};

export async function GET() {
  if (!isArchitectureEnabled(process.env.NODE_ENV)) {
    return new Response(null, {
      status: 404,
      headers: NO_STORE_HEADERS,
    });
  }

  try {
    const turns = await metricDb.turnMetric.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
    const summary = summarizeTurnMetrics(turns);

    return Response.json(
      { turns, summary: { turnCount: turns.length, ...summary } },
      { headers: NO_STORE_HEADERS },
    );
  } catch {
    return Response.json(
      { error: "Unable to read metrics." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
