import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import {
  convertToAffiliateUrl,
  type AffiliateIds,
  type Platform,
  PLATFORM_LABEL,
} from "./affiliate";

const AffiliateIdsSchema = z.object({
  amazon: z.string().max(60).optional(),
  magalu: z.string().max(60).optional(),
  mercadolivre: z.string().max(60).optional(),
  shopee: z.string().max(60).optional(),
});

const InputSchema = z.object({
  url: z.string().url(),
  tone: z.enum(["urgente", "amigavel", "profissional", "divertido"]).default("urgente"),
  affiliateIds: AffiliateIdsSchema.default({}),
  overrides: z
    .object({
      title: z.string().max(300).optional(),
      price: z.string().max(60).optional(),
      image: z.string().url().optional().or(z.literal("")).optional(),
    })
    .default({}),
});

export type Captions = {
  whatsapp: string;
  instagram: string;
  facebook: string;
  hashtags: string[];
  script: string;
};

export type OfferResult = {
  product: {
    title: string;
    price?: string;
    image?: string;
    description?: string;
  };
  platform: Platform;
  platformLabel: string;
  affiliateUrl: string;
  converted: boolean;
  note?: string;
  captions: Captions;
};

// --- OG tag scraper --------------------------------------------------------

function pickMeta(html: string, patterns: RegExp[]): string | undefined {
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) {
      return decodeHtml(m[1].trim());
    }
  }
  return undefined;
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

async function scrapeProduct(url: string): Promise<{
  title?: string;
  price?: string;
  image?: string;
  description?: string;
}> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    if (!res.ok) return {};
    const html = (await res.text()).slice(0, 400_000);

    const title = pickMeta(html, [
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i,
      /<title>([^<]+)<\/title>/i,
    ]);
    const image = pickMeta(html, [
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    ]);
    const description = pickMeta(html, [
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
    ]);
    const price = pickMeta(html, [
      /<meta[^>]+property=["']product:price:amount["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+property=["']og:price:amount["'][^>]+content=["']([^"']+)["']/i,
      /"price"\s*:\s*"?(\d+[.,]?\d*)"?/i,
    ]);

    return { title, image, description, price };
  } catch {
    return {};
  }
}

// --- JSON parsing for AI output --------------------------------------------

function extractJson(text: string): unknown | null {
  const cleaned = text.replace(/```json\s*|```/g, "");
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

// --- Server function -------------------------------------------------------

export const analyzeOffer = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<OfferResult> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY não configurada");

    // 1) Convert affiliate URL (pure)
    const conversion = convertToAffiliateUrl(data.url, data.affiliateIds as AffiliateIds);

    // 2) Scrape product data (best-effort)
    const scraped = await scrapeProduct(data.url);

    const product = {
      title: data.overrides.title || scraped.title || "Produto",
      price: data.overrides.price || formatPrice(scraped.price),
      image: data.overrides.image || scraped.image,
      description: scraped.description,
    };

    // 3) Generate captions
    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-2.5-flash");

    const toneMap: Record<string, string> = {
      urgente: "urgente, com senso de escassez e chamada forte para ação",
      amigavel: "amigável, próximo, como um amigo recomendando",
      profissional: "profissional, informativo, focado em benefícios",
      divertido: "divertido, descontraído, com humor leve",
    };

    const prompt = `Você é um copywriter especialista em ofertas de afiliado no Brasil.
Gere legendas em português do Brasil no tom ${toneMap[data.tone]} para o produto abaixo.
Cada rede social tem regras diferentes — RESPEITE:

- WhatsApp: mensagem CURTA para grupo, direto ao ponto. Estrutura: 1 linha de gancho com emoji + nome do produto em *negrito* + preço + 1 linha de CTA + link. Máx 350 caracteres, no máximo 6 linhas. SEM hashtags. SEM enrolação, SEM descrição longa de benefícios.
- Instagram: legenda de feed curta, 1 gancho + 2-3 linhas de benefício + CTA. Máx 400 caracteres. SEM hashtags no corpo.
- Facebook: curta e direta, gancho + benefício principal + CTA com link. Máx 400 caracteres. SEM hashtags.

Regra geral: seja OBJETIVO. Legendas longas performam pior em grupo de WhatsApp — as pessoas rolam.

Produto: ${product.title}
${product.price ? `Preço: ${product.price}` : ""}
${product.description ? `Descrição encontrada: ${product.description}` : ""}
Plataforma: ${PLATFORM_LABEL[conversion.platform]}
Link de afiliado: ${conversion.affiliateUrl}

Responda APENAS com JSON válido, sem markdown, sem crases, no formato:
{
  "whatsapp": "...",
  "instagram": "...",
  "facebook": "...",
  "hashtags": ["até 10 hashtags em minúsculas sem #"],
  "script": "roteiro curto de 3-5 linhas para Reels/Shorts sobre o produto"
}`;

    const { text } = await generateText({
      model,
      prompt,
      temperature: 0.85,
    });

    const parsed = extractJson(text) as Partial<Captions> | null;
    if (
      !parsed ||
      typeof parsed.whatsapp !== "string" ||
      typeof parsed.instagram !== "string" ||
      typeof parsed.facebook !== "string" ||
      !Array.isArray(parsed.hashtags) ||
      typeof parsed.script !== "string"
    ) {
      throw new Error("A IA retornou um formato inesperado. Tente novamente.");
    }

    return {
      product,
      platform: conversion.platform,
      platformLabel: PLATFORM_LABEL[conversion.platform],
      affiliateUrl: conversion.affiliateUrl,
      converted: conversion.converted,
      note: conversion.note,
      captions: {
        whatsapp: parsed.whatsapp,
        instagram: parsed.instagram,
        facebook: parsed.facebook,
        hashtags: parsed.hashtags.map((h) => String(h).replace(/^#/, "")).slice(0, 10),
        script: parsed.script,
      },
    };
  });

function formatPrice(raw?: string): string | undefined {
  if (!raw) return undefined;
  const num = parseFloat(raw.replace(",", "."));
  if (!Number.isFinite(num) || num <= 0) return undefined;
  return `R$ ${num.toFixed(2).replace(".", ",")}`;
}
