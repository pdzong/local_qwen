import OpenAI from "openai";

export function getServerOpenAI() {
  const baseURL =
    process.env.VLLM_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8000/v1";

  return new OpenAI({
    baseURL,
    apiKey: process.env.VLLM_API_KEY ?? "sk-local-edge",
  });
}

export function getDefaultModelId() {
  return process.env.VLLM_MODEL ?? "Qwen/Qwen3.6-35B-A3B";
}
