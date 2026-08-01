import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  message: z.string().trim().min(1).max(2000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .max(12)
    .default([]),
});

/** Strips markdown emphasis, bullet markers and emoji so replies stay professional. */
function toPlainText(text: string) {
  return text
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2190}-\u{21FF}]/gu, "")
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")
    .replace(/^\s*[-*+•]\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`{1,3}/g, "")
    .replace(/[ \t]+$/gm, "")
    .trim();
}

export const askAssistant = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured yet.");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          {
            role: "system",
            content:
              "You are the Malawian App Store assistant. Help Malawian developers write app listings (name, tagline, description, category), understand KYC verification, phone verification over WhatsApp, the MK5,000 monthly publishing subscription, and app update/versioning best practices. Be concise, practical and professional. Write in plain text only: never use markdown formatting, asterisks, bullet symbols, hashes, or emojis. Use short paragraphs, and where a list is needed use numbered lines such as '1.' on their own line. Amounts are in Malawian Kwacha (MK).",
          },
          ...data.history,
          { role: "user", content: data.message },
        ],
      }),
    });

    if (response.status === 429) throw new Error("Too many requests right now. Try again shortly.");
    if (response.status === 402) throw new Error("AI credits are exhausted. Please top up to continue.");
    if (!response.ok) throw new Error(`Assistant failed [${response.status}]: ${await response.text()}`);

    const json = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = json.choices?.[0]?.message?.content ?? "";
    return { reply: toPlainText(raw) || "Sorry, I had no answer for that." };
  });
