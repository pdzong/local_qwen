"use client";

import { useState } from "react";
import { Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

type RunRow = {
  index: number;
  ok: boolean;
  error?: string;
  wallTimeMs: number;
  promptTokens?: number;
  completionTokens?: number;
  decodeTokPerSec?: number;
};

type BenchmarkResponse = {
  model: string;
  maxTokens: number;
  runCount: number;
  concurrency: number;
  temperature: number;
  benchWallMs: number;
  perRun: RunRow[];
  summary: {
    completed: number;
    failed: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    aggregateDecodeTokPerSec?: number;
    meanPerRunDecodeTokPerSec?: number;
    minPerRunDecodeTokPerSec?: number;
    maxPerRunDecodeTokPerSec?: number;
  };
};

function fmt(n: number | undefined, digits = 1) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

export function BenchmarkPanel() {
  const [model, setModel] = useState("Qwen/Qwen3.6-35B-A3B");
  const [maxTokens, setMaxTokens] = useState("2048");
  const [runs, setRuns] = useState("4");
  const [concurrency, setConcurrency] = useState("1");
  const [temperature, setTemperature] = useState("0.2");
  const [system, setSystem] = useState(
    "You are a helpful assistant. Follow the user's instructions about length and structure.",
  );
  const [user, setUser] = useState(
    "Produce a long, structured technical write-up comparing CPU branch prediction, out-of-order execution, and SIMD exploitation, with sections, tradeoffs, and examples. Be verbose; aim to fill the allotted output tokens with substantive detail.",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BenchmarkResponse | null>(null);

  const runBench = async () => {
    setBusy(true);
    setError(null);
    setResult(null);

    const payload = {
      model,
      maxTokens: Number.parseInt(maxTokens, 10),
      runs: Number.parseInt(runs, 10),
      concurrency: Number.parseInt(concurrency, 10),
      temperature: Number.parseFloat(temperature),
      system,
      user,
    };

    try {
      const res = await fetch("/api/benchmark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as BenchmarkResponse & { error?: string };
      if (!res.ok) {
        throw new Error(
          typeof json.error === "string" ? json.error : `HTTP ${res.status}`,
        );
      }
      setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="flex w-full max-w-4xl flex-col shadow-sm">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-xl">Decode benchmark</CardTitle>
        <CardDescription>
          Sends non-streaming chat completions so vLLM can return token usage.
          Decode tok/s per run matches{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            completion_tokens / wall_time
          </code>
          ; aggregate tok/s is total completion tokens over the full benchmark
          wall clock (useful when concurrency is greater than one).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="bench-model">Model id</Label>
            <Input
              id="bench-model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bench-max">Max new tokens</Label>
            <Input
              id="bench-max"
              inputMode="numeric"
              value={maxTokens}
              onChange={(e) => setMaxTokens(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bench-runs">Runs</Label>
            <Input
              id="bench-runs"
              inputMode="numeric"
              value={runs}
              onChange={(e) => setRuns(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bench-conc">Concurrency</Label>
            <Input
              id="bench-conc"
              inputMode="numeric"
              value={concurrency}
              onChange={(e) => setConcurrency(e.target.value)}
              disabled={busy}
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="bench-temp">Temperature</Label>
            <Input
              id="bench-temp"
              inputMode="decimal"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              disabled={busy}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="bench-system">System prompt</Label>
          <Textarea
            id="bench-system"
            rows={2}
            value={system}
            onChange={(e) => setSystem(e.target.value)}
            disabled={busy}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bench-user">User prompt (keep long-generation intent)</Label>
          <Textarea
            id="bench-user"
            rows={5}
            value={user}
            onChange={(e) => setUser(e.target.value)}
            disabled={busy}
          />
        </div>

        {error && (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        )}

        {result && (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-4 text-sm">
            <p className="font-medium">Summary</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                Total wall time:{" "}
                <span className="font-mono">
                  {(result.benchWallMs / 1000).toFixed(2)}s
                </span>
              </div>
              <div>
                Completed / failed:{" "}
                <span className="font-mono">
                  {result.summary.completed} / {result.summary.failed}
                </span>
              </div>
              <div>
                Total prompt / completion tokens:{" "}
                <span className="font-mono">
                  {result.summary.totalPromptTokens} /{" "}
                  {result.summary.totalCompletionTokens}
                </span>
              </div>
              <div>
                Aggregate decode tok/s:{" "}
                <span className="font-mono">
                  {fmt(result.summary.aggregateDecodeTokPerSec)}
                </span>
              </div>
              <div>
                Mean per-run decode tok/s:{" "}
                <span className="font-mono">
                  {fmt(result.summary.meanPerRunDecodeTokPerSec)}
                </span>
              </div>
              <div>
                Per-run min / max decode tok/s:{" "}
                <span className="font-mono">
                  {fmt(result.summary.minPerRunDecodeTokPerSec)} /{" "}
                  {fmt(result.summary.maxPerRunDecodeTokPerSec)}
                </span>
              </div>
            </div>
            <Separator />
            <p className="font-medium">Per run</p>
            <div className="max-h-56 overflow-auto rounded border bg-background">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="border-b px-2 py-1 font-medium">#</th>
                    <th className="border-b px-2 py-1 font-medium">Wall s</th>
                    <th className="border-b px-2 py-1 font-medium">Out tok</th>
                    <th className="border-b px-2 py-1 font-medium">Decode tok/s</th>
                    <th className="border-b px-2 py-1 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {result.perRun.map((r) => (
                    <tr key={r.index} className="odd:bg-muted/40">
                      <td className="border-b px-2 py-1 font-mono">{r.index}</td>
                      <td className="border-b px-2 py-1 font-mono">
                        {(r.wallTimeMs / 1000).toFixed(2)}
                      </td>
                      <td className="border-b px-2 py-1 font-mono">
                        {r.completionTokens ?? "—"}
                      </td>
                      <td className="border-b px-2 py-1 font-mono">
                        {fmt(r.decodeTokPerSec)}
                      </td>
                      <td className="border-b px-2 py-1">
                        {r.ok ? (
                          "ok"
                        ) : (
                          <span className="text-destructive">{r.error}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="border-t pt-4">
        <Button
          type="button"
          onClick={() => void runBench()}
          disabled={busy}
          className="gap-2"
        >
          <Play className="size-4" />
          {busy ? "Running…" : "Run benchmark"}
        </Button>
      </CardFooter>
    </Card>
  );
}
