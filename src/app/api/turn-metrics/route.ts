import { db } from "@/lib/db";
import {
  applyMetricEvent,
  turnMetricEventSchema,
  type TurnMetricRecord,
} from "@/lib/observability/turn-metrics";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

interface TurnMetricDelegate {
  findUnique(args: {
    where: { turnId: string };
  }): Promise<TurnMetricRecord | null>;
  create(args: { data: TurnMetricRecord }): Promise<unknown>;
  update(args: {
    where: { turnId: string };
    data: TurnMetricRecord;
  }): Promise<unknown>;
}

interface TurnMetricDatabase {
  $transaction<T>(
    operation: (transaction: { turnMetric: TurnMetricDelegate }) => Promise<T>,
  ): Promise<T>;
}

const metricDb = db as unknown as TurnMetricDatabase;

function jsonResponse(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: NO_STORE_HEADERS,
  });
}

export async function POST(request: Request): Promise<Response> {
  if (process.env.NODE_ENV !== "development") {
    return jsonResponse({ error: "Not found." }, 404);
  }

  const origin = request.headers.get("Origin");
  if (origin !== null && origin !== new URL(request.url).origin) {
    return jsonResponse({ error: "Forbidden." }, 403);
  }

  const payload = await request.json().catch(() => null);
  const parsed = turnMetricEventSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonResponse({ error: "Invalid metric event." }, 400);
  }

  try {
    const accepted = await metricDb.$transaction(async (transaction) => {
      const existing = await transaction.turnMetric.findUnique({
        where: { turnId: parsed.data.turnId },
      });

      if (existing !== null && existing.sessionId !== parsed.data.sessionId) {
        return false;
      }

      const next = applyMetricEvent(existing, parsed.data);

      if (existing === null) {
        await transaction.turnMetric.create({ data: next });
      } else {
        await transaction.turnMetric.update({
          where: { turnId: next.turnId },
          data: next,
        });
      }

      return true;
    });

    return jsonResponse({ accepted }, 202);
  } catch {
    return jsonResponse({ error: "Unable to record metric." }, 500);
  }
}
