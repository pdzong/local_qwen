import { getDefaultModelId, getServerOpenAI } from "@/lib/server-openai";

export const runtime = "nodejs";

type BenchmarkBody = {
  model?: string;
  maxTokens?: number;
  runs?: number;
  concurrency?: number;
  temperature?: number;
  system?: string;
  user?: string;
};

type RunStat = {
  index: number;
  ok: boolean;
  error?: string;
  wallTimeMs: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  /** completion_tokens / (wall_s); comparable to per-request decode in vLLM logs */
  decodeTokPerSec?: number;
};

const DEFAULT_SYSTEM =
  "You are a helpful assistant. Follow the user's instructions about length and structure.";
const DEFAULT_USER =
  "Produce a long, structured technical write-up comparing CPU branch prediction, out-of-order execution, and SIMD exploitation, with sections, tradeoffs, and examples. Be verbose; aim to fill the allotted output tokens with substantive detail.";

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

export async function POST(request: Request) {
  let body: BenchmarkBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const runs = clamp(Math.floor(body.runs ?? 4), 1, 64);
  const concurrency = clamp(Math.floor(body.concurrency ?? 1), 1, 32);
  const maxTokens = clamp(Math.floor(body.maxTokens ?? 2048), 1, 32768);
  const temperature =
    typeof body.temperature === "number" && Number.isFinite(body.temperature)
      ? clamp(body.temperature, 0, 2)
      : 0.2;

  const model = body.model?.trim() || getDefaultModelId();
  const system = (body.system?.trim() || DEFAULT_SYSTEM).slice(0, 8000);
  const user = (body.user?.trim() || DEFAULT_USER).slice(0, 32000);

  const client = getServerOpenAI();
  const messages = [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user },
  ];

  const benchStarted = performance.now();
  const runStats: RunStat[] = [];

  let cursor = 0;
  async function one(index: number): Promise<RunStat> {
    const t0 = performance.now();
    try {
      const completion = await client.chat.completions.create({
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
        stream: false,
      });
      const wallTimeMs = performance.now() - t0;
      const usage = completion.usage;
      const promptTokens = usage?.prompt_tokens;
      const completionTokens = usage?.completion_tokens;
      const totalTokens = usage?.total_tokens;
      const decodeTokPerSec =
        completionTokens != null && completionTokens > 0 && wallTimeMs > 0
          ? completionTokens / (wallTimeMs / 1000)
          : undefined;

      return {
        index,
        ok: true,
        wallTimeMs,
        promptTokens,
        completionTokens,
        totalTokens,
        decodeTokPerSec,
      };
    } catch (err: unknown) {
      const wallTimeMs = performance.now() - t0;
      const message = err instanceof Error ? err.message : "Upstream error";
      return { index, ok: false, error: message, wallTimeMs };
    }
  }

  while (cursor < runs) {
    const batchSize = Math.min(concurrency, runs - cursor);
    const batch = Array.from({ length: batchSize }, (_, j) =>
      one(cursor + j),
    );
    const batchOut = await Promise.all(batch);
    runStats.push(...batchOut);
    cursor += batchSize;
  }

  const benchWallMs = performance.now() - benchStarted;

  const okRuns = runStats.filter((r) => r.ok);
  const failed = runStats.length - okRuns.length;
  const totalCompletionTokens = okRuns.reduce(
    (s, r) => s + (r.completionTokens ?? 0),
    0,
  );
  const totalPromptTokens = okRuns.reduce(
    (s, r) => s + (r.promptTokens ?? 0),
    0,
  );

  const runsWithDecode = okRuns.filter((r) => r.decodeTokPerSec != null);
  const meanDecodeTokPerSecSafe =
    runsWithDecode.length > 0
      ? runsWithDecode.reduce((s, r) => s + (r.decodeTokPerSec ?? 0), 0) /
        runsWithDecode.length
      : undefined;

  const aggregateDecodeTokPerSec =
    totalCompletionTokens > 0 && benchWallMs > 0
      ? totalCompletionTokens / (benchWallMs / 1000)
      : undefined;

  const minDecode = runsWithDecode.length
    ? Math.min(...runsWithDecode.map((r) => r.decodeTokPerSec!))
    : undefined;
  const maxDecode = runsWithDecode.length
    ? Math.max(...runsWithDecode.map((r) => r.decodeTokPerSec!))
    : undefined;

  return Response.json({
    model,
    maxTokens,
    runCount: runs,
    concurrency,
    temperature,
    benchWallMs,
    perRun: runStats.sort((a, b) => a.index - b.index),
    summary: {
      completed: okRuns.length,
      failed,
      totalPromptTokens,
      totalCompletionTokens,
      /** Wall-clock decode throughput for the whole benchmark (good under concurrency). */
      aggregateDecodeTokPerSec,
      /** Mean of per-request decode tok/s (each run timed individually). */
      meanPerRunDecodeTokPerSec: meanDecodeTokPerSecSafe,
      minPerRunDecodeTokPerSec: minDecode,
      maxPerRunDecodeTokPerSec: maxDecode,
    },
  });
}
