"use client";

import { useCallback, useRef, useState } from "react";
import { Send } from "lucide-react";

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

type Role = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: Role;
  content: string;
};

function createId() {
  return crypto.randomUUID();
}

export function ChatPanel() {
  const [model, setModel] = useState("Qwen/Qwen3.6-35B-A3B");
  const [maxTokens, setMaxTokens] = useState("1024");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || streaming) return;

    const userMessage: ChatMessage = {
      id: createId(),
      role: "user",
      content: trimmed,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setError(null);
    setStreaming(true);

    const assistantId = createId();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "" },
    ]);

    const max = Number.parseInt(maxTokens, 10);
    const payload = {
      model,
      maxTokens: Number.isFinite(max) ? max : 1024,
      messages: nextMessages.map(({ role, content }) => ({ role, content })),
    };

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        const msg =
          (errJson && typeof errJson.error === "string" && errJson.error) ||
          `Request failed (${res.status})`;
        throw new Error(msg);
      }

      if (!res.body) {
        throw new Error("No response body");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: accumulated } : m,
          ),
        );
        requestAnimationFrame(scrollToBottom);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      setError(msg);
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setStreaming(false);
      requestAnimationFrame(scrollToBottom);
    }
  };

  return (
    <Card className="flex h-[min(720px,calc(100vh-4rem))] w-full max-w-3xl flex-col shadow-sm">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-xl">vLLM chat</CardTitle>
        <CardDescription>
          Messages go to your OpenAI-compatible server (defaults match local
          vLLM on port 8000).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="model">Model id</Label>
            <Input
              id="model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={streaming}
              placeholder="Qwen/Qwen3.6-35B-A3B"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="max-tokens">Max tokens</Label>
            <Input
              id="max-tokens"
              inputMode="numeric"
              value={maxTokens}
              onChange={(e) => setMaxTokens(e.target.value)}
              disabled={streaming}
            />
          </div>
        </div>
        <Separator />
        <div
          ref={scrollContainerRef}
          className="min-h-0 flex-1 overflow-y-auto rounded-lg border"
        >
          <div className="space-y-4 p-4">
            {messages.length === 0 && (
              <p className="text-muted-foreground text-sm">
                Start a conversation. The app calls{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">
                  /api/chat
                </code>{" "}
                which streams from your vLLM base URL.
              </p>
            )}
            {messages.map((m) => (
              <div key={m.id} className="space-y-1">
                <p className="text-muted-foreground text-xs font-medium uppercase">
                  {m.role}
                </p>
                <div className="text-sm whitespace-pre-wrap break-words">
                  {m.content || (m.role === "assistant" ? "…" : "")}
                </div>
              </div>
            ))}
          </div>
        </div>
        {error && (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-end">
        <div className="flex w-full flex-1 flex-col gap-2">
          <Label htmlFor="message">Message</Label>
          <Textarea
            id="message"
            rows={3}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={streaming}
            placeholder="Ask anything…"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendMessage();
              }
            }}
          />
        </div>
        <Button
          type="button"
          className="w-full sm:w-auto"
          onClick={() => void sendMessage()}
          disabled={streaming || !input.trim()}
        >
          <Send className="size-4" data-icon="inline-start" />
          Send
        </Button>
      </CardFooter>
    </Card>
  );
}
