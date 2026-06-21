import OpenAI from "openai";
import { SYSTEM_PROMPT } from "./system-prompt";

const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "Accept-Encoding": "identity",
  },
});

const MODEL = process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";

export interface HistoryMessage {
  role: "user" | "assistant" | "human";
  content: string;
}

export async function generateReply(history: HistoryMessage[]): Promise<string> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map((m) => ({
      role: m.role === "human" ? ("assistant" as const) : m.role,
      content: m.content,
    })),
  ];

  const start = Date.now();
  const res = await client.chat.completions.create({ model: MODEL, messages, max_tokens: 400 });
  console.log(`[bot] LLM respondió en ${Date.now() - start}ms`);

  return res.choices[0]?.message?.content ?? "Lo siento, no pude generar una respuesta.";
}
