import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Sparkles,
  Copy,
  Check,
  Loader2,
  Link as LinkIcon,
  Settings,
  MessageCircle,
  Instagram,
  Facebook,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { analyzeOffer, type OfferResult } from "@/lib/offer.functions";
import type { AffiliateIds } from "@/lib/affiliate";

export const Route = createFileRoute("/")({
  component: Index,
});

type Tone = "urgente" | "amigavel" | "profissional" | "divertido";

const IDS_STORAGE_KEY = "achouai:affiliate-ids";

function loadIds(): AffiliateIds {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(IDS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AffiliateIds) : {};
  } catch {
    return {};
  }
}

function Index() {
  const [url, setUrl] = useState("");
  const [tone, setTone] = useState<Tone>("urgente");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OfferResult | null>(null);
  const [ids, setIds] = useState<AffiliateIds>({});
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    setIds(loadIds());
  }, []);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) {
      toast.error("Cole o link do produto");
      return;
    }
    try {
      new URL(trimmed);
    } catch {
      toast.error("Link inválido");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const data = await analyzeOffer({
        data: { url: trimmed, tone, affiliateIds: ids, overrides: {} },
      });
      setResult(data);
      toast.success("Oferta pronta!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao processar";
      if (msg.includes("429")) toast.error("Muitas requisições. Aguarde alguns segundos.");
      else if (msg.includes("402")) toast.error("Créditos de IA esgotados.");
      else toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  function saveIds(next: AffiliateIds) {
    setIds(next);
    window.localStorage.setItem(IDS_STORAGE_KEY, JSON.stringify(next));
    toast.success("IDs de afiliado salvos");
    setSettingsOpen(false);
  }

  return (
    <div className="min-h-screen">
      <header className="mx-auto max-w-6xl px-6 pt-8 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl btn-hero">
            <Sparkles className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold">AchouAI</span>
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary hover:bg-muted text-sm"
        >
          <Settings className="h-4 w-4" />
          IDs de afiliado
        </button>
      </header>

      <section className="mx-auto max-w-4xl px-6 pt-6 pb-8 text-center">
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
          Cole o link, <span className="gradient-text">receba tudo pronto</span>
        </h1>
        <p className="mt-4 text-base text-muted-foreground max-w-2xl mx-auto">
          Link do produto → link de afiliado convertido + legendas prontas
          para WhatsApp, Instagram e Facebook.
        </p>
      </section>

      <main className="mx-auto max-w-4xl px-6 pb-24 space-y-6">
        <form onSubmit={handleGenerate} className="card-glass rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <LinkIcon className="h-4 w-4 text-primary" />
            Link do produto
          </div>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://amazon.com.br/... ou magazineluiza.com.br/..."
            className="input"
            type="url"
            required
          />

          <div>
            <div className="text-sm font-medium mb-2">Tom da mensagem</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {(["urgente", "amigavel", "profissional", "divertido"] as Tone[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTone(t)}
                  className={`px-3 py-2 rounded-md text-sm font-medium capitalize transition ${
                    tone === t
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-muted"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-hero rounded-lg px-5 py-3 font-semibold flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Processando…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Gerar oferta
              </>
            )}
          </button>
        </form>

        {loading && (
          <div className="card-glass rounded-2xl p-8 text-center">
            <Loader2 className="h-10 w-10 mb-3 animate-spin text-primary mx-auto" />
            <p className="font-medium">Buscando dados do produto e gerando legendas…</p>
          </div>
        )}

        {result && <ResultView result={result} />}
      </main>

      {settingsOpen && (
        <SettingsModal
          initial={ids}
          onClose={() => setSettingsOpen(false)}
          onSave={saveIds}
        />
      )}

      <style>{`
        .input {
          width: 100%;
          background: var(--input);
          border: 1px solid var(--border);
          border-radius: 0.5rem;
          padding: 0.7rem 0.9rem;
          font-size: 0.95rem;
          color: var(--foreground);
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .input:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px oklch(0.72 0.19 45 / 0.15); }
      `}</style>
    </div>
  );
}

function ResultView({ result }: { result: OfferResult }) {
  return (
    <div className="space-y-5">
      <div className="card-glass rounded-2xl p-5">
        <div className="flex items-start gap-4">
          {result.product.image && (
            <img
              src={result.product.image}
              alt={result.product.title}
              className="w-24 h-24 rounded-lg object-cover bg-muted flex-shrink-0"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
              {result.platformLabel}
            </div>
            <h2 className="font-semibold text-base leading-snug">{result.product.title}</h2>
            {result.product.price && (
              <div className="mt-1 text-primary font-bold">{result.product.price}</div>
            )}
          </div>
        </div>

        {result.note && (
          <div className="mt-4 flex gap-2 text-sm p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-200">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{result.note}</span>
          </div>
        )}

        <div className="mt-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
            Link {result.converted ? "de afiliado" : "(passe pelo painel de afiliado)"}
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-muted/50 rounded p-2 truncate">
              {result.affiliateUrl}
            </code>
            <CopyButton value={result.affiliateUrl} label="Link" />
            <a
              href={result.affiliateUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded hover:bg-muted"
              title="Abrir"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>

      <CaptionCard
        icon={<MessageCircle className="h-4 w-4 text-green-400" />}
        label="WhatsApp"
        text={buildFullText(result.captions.whatsapp, result.affiliateUrl, [])}
        shareUrl={`https://wa.me/?text=${encodeURIComponent(
          buildFullText(result.captions.whatsapp, result.affiliateUrl, []),
        )}`}
        shareLabel="Abrir no WhatsApp"
      />
      <CaptionCard
        icon={<Instagram className="h-4 w-4 text-pink-400" />}
        label="Instagram"
        text={buildFullText(result.captions.instagram, result.affiliateUrl, result.captions.hashtags)}
      />
      <CaptionCard
        icon={<Facebook className="h-4 w-4 text-blue-400" />}
        label="Facebook"
        text={buildFullText(result.captions.facebook, result.affiliateUrl, [])}
        shareUrl={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(result.affiliateUrl)}`}
        shareLabel="Compartilhar no Facebook"
      />
      <CaptionCard
        icon={<Sparkles className="h-4 w-4 text-primary" />}
        label="Roteiro Reels/Shorts"
        text={result.captions.script}
      />
    </div>
  );
}

function buildFullText(base: string, url: string, hashtags: string[]): string {
  const hasUrl = base.includes(url);
  const parts = [base.trim()];
  if (!hasUrl) parts.push(`\n👉 ${url}`);
  if (hashtags.length) parts.push("\n\n" + hashtags.map((h) => `#${h}`).join(" "));
  return parts.join("");
}

function CaptionCard({
  icon,
  label,
  text,
  shareUrl,
  shareLabel,
}: {
  icon: React.ReactNode;
  label: string;
  text: string;
  shareUrl?: string;
  shareLabel?: string;
}) {
  return (
    <div className="card-glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 font-semibold text-sm">
          {icon}
          {label}
        </div>
        <div className="flex items-center gap-2">
          {shareUrl && (
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs flex items-center gap-1 px-3 py-1.5 rounded bg-primary text-primary-foreground hover:opacity-90 transition"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {shareLabel}
            </a>
          )}
          <CopyButton value={text} label={label} />
        </div>
      </div>
      <div className="text-sm whitespace-pre-wrap leading-relaxed">{text}</div>
    </div>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        toast.success(`${label} copiado`);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="text-xs flex items-center gap-1 px-3 py-1.5 rounded bg-secondary hover:bg-muted transition"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
}

function SettingsModal({
  initial,
  onClose,
  onSave,
}: {
  initial: AffiliateIds;
  onClose: () => void;
  onSave: (ids: AffiliateIds) => void;
}) {
  const [amazon, setAmazon] = useState(initial.amazon ?? "");
  const [magalu, setMagalu] = useState(initial.magalu ?? "");
  const [ml, setMl] = useState(initial.mercadolivre ?? "");
  const [shopee, setShopee] = useState(initial.shopee ?? "");

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="card-glass rounded-2xl p-6 w-full max-w-lg space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="text-lg font-semibold">Seus IDs de afiliado</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Salvos apenas no seu navegador. Usados para converter os links automaticamente.
          </p>
        </div>

        <IdField
          label="Amazon (tag)"
          hint="Ex: seunome-20"
          value={amazon}
          onChange={setAmazon}
        />
        <IdField
          label="Magazine Luiza (Magazine Você)"
          hint="Ex: seunome — vira magazinevoce.com.br/magazinevoceseunome/…"
          value={magalu}
          onChange={setMagalu}
        />
        <IdField
          label="Mercado Livre"
          hint="Informativo — no ML você precisa gerar o link /sec/ no painel deles"
          value={ml}
          onChange={setMl}
        />
        <IdField
          label="Shopee"
          hint="Informativo — gere o shortlink no painel Shopee Afiliados"
          value={shopee}
          onChange={setShopee}
        />

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-secondary hover:bg-muted text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={() =>
              onSave({
                amazon: amazon.trim() || undefined,
                magalu: magalu.trim() || undefined,
                mercadolivre: ml.trim() || undefined,
                shopee: shopee.trim() || undefined,
              })
            }
            className="btn-hero px-4 py-2 rounded-lg text-sm font-semibold"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

function IdField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input"
      />
      <p className="text-xs text-muted-foreground mt-1">{hint}</p>
    </div>
  );
}
