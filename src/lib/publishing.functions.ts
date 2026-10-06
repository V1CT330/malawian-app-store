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
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "")
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
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured yet.");

    const context = [
      `Product type: ${data.kind}`,
      `Category: ${data.category || "unspecified"}`,
      `Name: ${data.name || "untitled"}`,
      `Tagline: ${data.tagline || "none"}`,
      `Description: ${data.description || "none"}`,
      data.extra ? `Extra notes: ${data.extra}` : "",
      data.task === "translate" ? `Target language: ${data.language}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          {
            role: "system",
            content:
              "You are the publishing assistant for the Malawian App Store. You help developers prepare store listings. Write in plain text only: never use markdown, asterisks, bullet symbols, hashes or emojis. Where a list is needed use numbered lines. Amounts are in Malawian Kwacha (MK).",
          },
          { role: "user", content: `${PROMPTS[data.task]}\n\n${context}` },
        ],
      }),
    });

    if (response.status === 429) throw new Error("Too many requests right now. Try again shortly.");
    if (response.status === 402)
      throw new Error("AI credits are exhausted. Please top up to continue.");
    if (!response.ok) throw new Error(`Assistant failed [${response.status}]`);

    const json = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    return {
      text: toPlainText(json.choices?.[0]?.message?.content ?? "") || "No suggestion returned.",
    };
  });
