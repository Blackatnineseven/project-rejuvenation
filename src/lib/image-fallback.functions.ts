import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  query: z.string().min(2).max(200),
});

export type FallbackImage = {
  url: string;
  source: "pexels" | "unsplash-source" | "none";
  credit?: string;
};

// Simplify a product title into a short search query (2-4 keywords).
function simplifyQuery(raw: string): string {
  const stop = new Set([
    "de","da","do","com","para","por","em","e","ou","a","o","os","as","um","uma",
    "the","and","for","with","of","in","on","to","new","novo","nova",
  ]);
  const words = raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stop.has(w));
  // Prefer first meaningful nouns
  return words.slice(0, 4).join(" ") || raw;
}

export const findFallbackImage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<FallbackImage> => {
    const query = simplifyQuery(data.query);
    const key = process.env.PEXELS_API_KEY;

    if (key) {
      try {
        const res = await fetch(
          `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5&orientation=square&locale=pt-BR`,
          { headers: { Authorization: key } },
        );
        if (res.ok) {
          const json = (await res.json()) as {
            photos?: Array<{
              src?: { large?: string; large2x?: string; original?: string };
              photographer?: string;
            }>;
          };
          const first = json.photos?.[0];
          const url = first?.src?.large2x || first?.src?.large || first?.src?.original;
          if (url) {
            return {
              url,
              source: "pexels",
              credit: first?.photographer ? `Foto: ${first.photographer} / Pexels` : "Pexels",
            };
          }
        }
      } catch {
        // fall through
      }
    }

    // No key or no result — return a signal so the UI can offer manual upload.
    return { url: "", source: "none" };
  });
