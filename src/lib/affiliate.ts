// Pure client+server helpers for affiliate link conversion.

export type AffiliateIds = {
  amazon?: string;      // ex: "seunome-20"
  magalu?: string;      // ex: "seunome"  (usado em magazinevoce.com.br/magazinevoceSEUID/)
  mercadolivre?: string;
  shopee?: string;
};

export type Platform =
  | "amazon"
  | "mercadolivre"
  | "shopee"
  | "magalu"
  | "aliexpress"
  | "outro";

export function detectPlatform(rawUrl: string): Platform {
  const url = rawUrl.toLowerCase();
  if (url.includes("amazon.")) return "amazon";
  if (url.includes("mercadolivre.") || url.includes("mercadolibre.")) return "mercadolivre";
  if (url.includes("shopee.")) return "shopee";
  if (url.includes("magazineluiza.") || url.includes("magazinevoce.")) return "magalu";
  if (url.includes("aliexpress.")) return "aliexpress";
  return "outro";
}

export type ConversionResult = {
  platform: Platform;
  affiliateUrl: string;
  converted: boolean;
  note?: string;
};

export function convertToAffiliateUrl(rawUrl: string, ids: AffiliateIds): ConversionResult {
  const platform = detectPlatform(rawUrl);
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { platform, affiliateUrl: rawUrl, converted: false, note: "URL inválida" };
  }

  if (platform === "amazon" && ids.amazon) {
    url.searchParams.set("tag", ids.amazon);
    return { platform, affiliateUrl: url.toString(), converted: true };
  }

  if (platform === "magalu" && ids.magalu) {
    // Se já é magazinevoce, apenas troca o subpath do parceiro.
    if (url.hostname.includes("magazinevoce.com.br")) {
      const parts = url.pathname.split("/").filter(Boolean);
      // parts[0] normalmente é "magazinevoceSEUID"
      parts[0] = `magazinevoce${ids.magalu}`;
      url.pathname = "/" + parts.join("/");
      return { platform, affiliateUrl: url.toString(), converted: true };
    }
    // magazineluiza.com.br/produto/... -> magazinevoce.com.br/magazinevoceID/produto/...
    if (url.hostname.includes("magazineluiza.com.br")) {
      const newUrl = new URL(url.toString());
      newUrl.hostname = "www.magazinevoce.com.br";
      newUrl.pathname = `/magazinevoce${ids.magalu}${url.pathname}`;
      return { platform, affiliateUrl: newUrl.toString(), converted: true };
    }
  }

  if (platform === "mercadolivre") {
    // ML só gera shortlink /sec/ dentro do painel. Se já veio /sec/ ou /social/, mantém.
    if (url.pathname.includes("/sec/") || url.pathname.includes("/social/")) {
      return { platform, affiliateUrl: url.toString(), converted: true };
    }
    return {
      platform,
      affiliateUrl: url.toString(),
      converted: false,
      note: "Cole o link de afiliado gerado no painel do Mercado Livre (formato /sec/...).",
    };
  }

  if (platform === "shopee") {
    if (url.hostname.includes("s.shopee")) {
      return { platform, affiliateUrl: url.toString(), converted: true };
    }
    return {
      platform,
      affiliateUrl: url.toString(),
      converted: false,
      note: "Gere o shortlink no painel Shopee Afiliados (s.shopee.com.br/...).",
    };
  }

  return {
    platform,
    affiliateUrl: url.toString(),
    converted: false,
    note: platform === "outro" ? "Plataforma não reconhecida — link mantido como está." : undefined,
  };
}

export const PLATFORM_LABEL: Record<Platform, string> = {
  amazon: "Amazon",
  mercadolivre: "Mercado Livre",
  shopee: "Shopee",
  magalu: "Magalu",
  aliexpress: "AliExpress",
  outro: "Outro",
};
