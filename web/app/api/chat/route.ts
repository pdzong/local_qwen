import type OpenAI from "openai";

import { getDefaultModelId, getServerOpenAI } from "@/lib/server-openai";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: {
    messages?: OpenAI.Chat.ChatCompletionMessageParam[];
    model?: string;
    maxTokens?: number;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const messages = body.messages;
  if (!messages?.length) {
    return Response.json({ error: "messages is required" }, { status: 400 });
  }

  const model = body.model ?? getDefaultModelId();
  const maxTokens = body.maxTokens ?? 1024;

  const client = getServerOpenAI();

  try {
    const stream = await client.chat.completions.create({
      model,
      messages,
      max_tokens: maxTokens,
      stream: true,
    });

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Upstream error";
    return Response.json({ error: message }, { status: 502 });
  }
}
