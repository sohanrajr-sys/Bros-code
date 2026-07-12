import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const POLL_INTERVAL_MS = 500;
const TERMINAL_STATUSES = new Set(["PASSED", "FAILED", "ERROR"]);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const encoder = new TextEncoder();

  let closed = false;
  let intervalId: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      let lastStatus: string | null = null;

      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      const stop = () => {
        if (closed) return;
        closed = true;
        if (intervalId) clearInterval(intervalId);
        try {
          controller.close();
        } catch {
          // already closed by client disconnect
        }
      };

      const poll = async () => {
        if (closed) return;

        const submission = await prisma.submission.findUnique({ where: { id } });
        if (!submission) {
          send("error", { error: "submission not found" });
          stop();
          return;
        }

        if (submission.status !== lastStatus) {
          lastStatus = submission.status;
          send("status", submission);
        }

        if (TERMINAL_STATUSES.has(submission.status)) {
          stop();
        }
      };

      poll().catch((err) => {
        send("error", { error: err instanceof Error ? err.message : String(err) });
        stop();
      });
      intervalId = setInterval(() => {
        poll().catch((err) => {
          send("error", { error: err instanceof Error ? err.message : String(err) });
          stop();
        });
      }, POLL_INTERVAL_MS);
    },
    cancel() {
      closed = true;
      if (intervalId) clearInterval(intervalId);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
