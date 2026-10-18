import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const AI_TASKS = [
  "description",
  "keywords",
  "release_notes",
  "translate",
  "grammar",
  "quality",
  "titles",
  "screenshots",
  "seo",
] as const;

const Input = z.object({
  task: z.enum(AI_TASKS),
  name: z.string().trim().max(120).default(""),
  tagline: z.string().trim().max(300).default(""),
  description: z.string().trim().max(4000).default(""),
  category: z.string().trim().max(60).default(""),
  kind: z.string().trim().max(40).default("app"),
  extra: z.string().trim().max(2000).default(""),
  language: z.string().trim().max(40).default("Chichewa"),
});

const PROMPTS: Record<(typeof AI_TASKS)[number], string> = {
  description:
    "Write a store description of 120 to 200 words for this product. Lead with what it does, then the main features, then who it is for. Plain professional prose.",
  keywords:
    "Produce 12 store search keywords for this product, one per line, lowercase, no numbering and no punctuation. Keywords only, no commentary.",
  release_notes:
    "Write concise release notes for the change summary provided in the extra notes. Use numbered lines. No more than 8 lines.",
  translate:
    "Translate the product name, tagline and description into the requested language. Keep the same structure and label each part on its own line.",
  grammar:
    "Correct the grammar, spelling and punctuation of the listing text. Return the corrected text only, keeping the original meaning and length.",
  quality:
    "Assess this listing's quality for an app store. Give a score out of 100 on the first line as 'Score: N', then numbered, specific improvements.",
  titles: "Suggest 6 stronger product titles, one per line, each under 30 characters. Titles only.",
  screenshots:
    "Recommend 5 screenshots this product should show in the store, one per line, describing the screen and the caption to use.",
  seo: "List the missing or weak parts of this listing for store search, then give numbered actions to fix each one.",
};

function toPlainText(text: string) {
  return text
    .replace(/\p{Extended_Pictographic}\uFE0F?/gu, "")
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")
    .replace(/^\s*[-*+•]\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`{1,3}/g, "")
    .replace(/[\u2013\u2014]/g, ",")
    .replace(/ - /g, ", ")
    .trim();
}

export const publishingAssist = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    const { completeNvidiaChat } = await import("@/lib/nvidia-ai.server");
    const text = await completeNvidiaChat(
      [
        {
          role: "system",
          content:
            "You are the publishing assistant for the Malawian App Store. You help developers prepare store listings. Write in plain text only: never use markdown, asterisks, bullet symbols, hashes or emojis. Where a list is needed use numbered lines. Amounts are in Malawian Kwacha (MK).",
        },
        { role: "user", content: `${PROMPTS[data.task]}\n\n${context}` },
      ],
      1400,
    );

    return {
      text: toPlainText(text) || "No suggestion returned.",
    };
  });
