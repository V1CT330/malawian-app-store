type NvidiaMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type NvidiaChatResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
};

const NVIDIA_CHAT_COMPLETIONS_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const DEFAULT_NVIDIA_MODEL = "meta/llama-3.3-70b-instruct";

/**
 * Server-only NVIDIA API Catalog client shared by MAS AI features.
 * Keep NVIDIA_API_KEY in server environment variables; never use a VITE_ prefix.
 */
export async function completeNvidiaChat(messages: NvidiaMessage[], maxTokens = 1200) {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error("AI is not configured yet. Set NVIDIA_API_KEY on the server.");
  }

  let response: Response;
  try {
    response = await fetch(NVIDIA_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model: process.env.NVIDIA_MODEL?.trim() || DEFAULT_NVIDIA_MODEL,
        messages,
        max_tokens: maxTokens,
        temperature: 0.4,
        stream: false,
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new Error("NVIDIA AI is temporarily unavailable. Please try again shortly.");
  }

  if (response.status === 429) {
    throw new Error("NVIDIA AI is receiving too many requests. Please try again shortly.");
  }
  if (response.status === 402) {
    throw new Error("NVIDIA AI usage is unavailable. Check the NVIDIA API account and usage limits.");
  }
  if (!response.ok) {
    throw new Error(`NVIDIA AI request failed (${response.status}). Please try again later.`);
  }

  const result = (await response.json()) as NvidiaChatResponse;
  const content = result.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("NVIDIA AI returned an empty response. Please try again.");
  return content;
}
