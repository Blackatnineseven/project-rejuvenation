import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const InputSchema = z.object({
  productName: z.string().min(2).max(200),
  price: z.number().nonnegative().optional(),
  platform: z.string().max(60).optional(),
  category: z.string().max(60).optional(),
  url: z.string().url().optional().or(z.literal("")).optional(),
  tone: z.enum(["urgente", "amigavel", "profissional", "divertido"]).default("urgente"),
});

export type GeneratedContent = {
  title: string;
  post: string;
  hashtags: string[];
  script: string;
};

function safeExtractJson(text: string): GeneratedContent | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    if (
      typeof parsed.title === "string" &&
      typeof parsed.post === "string" &&
      Array.isArray(parsed.hashtags) &&
      typeof parsed.script === "string"
    ) {
      return {
        title: parsed.title,
        post: parsed.post,
        hashtags: parsed.hashtags.map((h: unknown) => String(h)).slice(0, 12),
        script: parsed.script,
      };
    }
  } catch {
    return null;
  }
  return null;
}

export const generateContent = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<GeneratedContent> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY não configurada");

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-2.5-flash");

    const priceText =
      typeof data.price === "number" && data.price > 0
        ? `R$ ${data.price.toFixed(2).replace(".", ",")}`
        : "consulte no link";

    const toneMap: Record<string, string> = {
      urgente: "urgente, com senso de escassez e chamada forte para ação",
      amigavel: "amigável, próximo, como um amigo recomendando",
      profissional: "profissional, informativo, focado em benefícios",
      divertido: "divertido, descontraído, com humor leve",
    };

    const prompt = `Você é o AchouAI, um copywriter especialista em posts de ofertas de afiliado para redes sociais brasileiras (Instagram, Telegram, WhatsApp).

Gere conteúdo em português do Brasil para a oferta abaixo, em tom ${toneMap[data.tone]}.

Produto: ${data.productName}
Preço: ${priceText}
Plataforma: ${data.platform || "loja online"}
Categoria: ${data.category || "não informada"}
Link: ${data.url || "(será inserido depois)"}

Responda APENAS com um JSON válido, sem markdown, sem \`\`\`, no formato exato:
{
  "title": "título curto e chamativo (até 70 caracteres)",
  "post": "post completo pronto para publicar, com emojis, quebras de linha, benefícios e CTA. NÃO inclua hashtags aqui. Se o link foi passado, inclua-o. Máx 900 caracteres.",
  "hashtags": ["até 8 hashtags relevantes em minúsculas, sem #"],
  "script": "roteiro curto (3-5 linhas) para vídeo Reels/Shorts falando sobre o produto"
}`;

    const { text } = await generateText({
      model,
      prompt,
      temperature: 0.85,
    });

    const parsed = safeExtractJson(text);
    if (!parsed) {
      throw new Error("A IA retornou um formato inesperado. Tente novamente.");
    }
    return parsed;
  });
