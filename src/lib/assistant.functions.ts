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
    .replace(/\p{Extended_Pictographic}\uFE0F?/gu, "")
    .replace(/[\u2190-\u21FF]/g, "")
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")
    .replace(/^\s*[-*+•]\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`{1,3}/g, "")
    .replace(/[\u2013\u2014]/g, ",")
    .replace(/ - /g, ", ")
    .replace(/[ \t]+$/gm, "")
    .trim();
}

export const askAssistant = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    const { completeNvidiaChat } = await import("@/lib/nvidia-ai.server");
    const raw = await completeNvidiaChat([
      {
        role: "system",
        content: "You are the Malawian App Store assistant. Help Malawian developers write app listings, understand KYC verification, phone verification over WhatsApp, the MK5,000 monthly publishing subscription, and app update/versioning best practices. Be concise, practical and professional. Use plain text only, no markdown or emojis. Use numbered lines for lists. Amounts are in Malawian Kwacha (MK).",
      },
      ...data.history,
      { role: "user", content: data.message },
    ], 1200);

    return { reply: toPlainText(raw) || "Sorry, I had no answer for that." };
  });
