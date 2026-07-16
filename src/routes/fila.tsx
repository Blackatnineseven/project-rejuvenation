import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Sparkles,
  Loader2,
  Trash2,
  Check,
  MessageCircle,
  Instagram,
  Facebook,
  Copy,
  ExternalLink,
  ArrowLeft,
  ListPlus,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { analyzeOffer, type OfferResult } from "@/lib/offer.functions";
import type { AffiliateIds } from "@/lib/affiliate";

export const Route = createFileRoute("/fila")({
  component: FilaPage,
  head: () => ({
    meta: [
      { title: "Fila de ofertas do dia — AchouAI" },
      {
        name: "description",
        content:
          "Cole vários links de uma vez, gere todas as ofertas e vá postando ao longo do dia.",
      },
    ],
  }),
});

type Tone = "urgente" | "amigavel" | "profissional" | "divertido";

type QueueItem = {
  id: string;
  url: string;
  status: "pending" | "loading" | "done" | "error";
  result?: OfferResult;
  error?: string;
  postedWhats?: boolean;
  postedInsta?: boolean;
  postedFace?: boolean;
};

const IDS_STORAGE_KEY = "achouai:affiliate-ids";
const QUEUE_STORAGE_KEY = "achouai:queue-v1";

function loadIds(): AffiliateIds {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(IDS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AffiliateIds) : {};
  } catch {
    return {};
  }
}

function loadQueue(): QueueItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as QueueItem[]) : [];
  } catch {
    return [];
  }
}

function saveQueue(items: QueueItem[]) {
  window.localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(items));
}

function FilaPage() {
  const [input, setInput] = useState("");
  const [tone, setTone] = useState<Tone>("urgente");
  const [items, setItems] = useState<QueueItem[]>([]);
  const [running, setRunning] = useState(false);
  const [ids, setIds] = useState<AffiliateIds>({});

  useEffect(() => {
    setIds(loadIds());
    setItems(loadQueue());
  }, []);

  useEffect(() => {
    saveQueue(items);
  }, [items]);

  const stats = useMemo(() => {
    const done = items.filter((i) => i.status === "done").length;
    const posted = items.filter(
      (i) => i.postedWhats || i.postedInsta || i.postedFace,
    ).length;
    return { total: items.length, done, posted };
  }, [items]);

  function parseUrls(text: string): string[] {
    return Array.from(
      new Set(
        text
          .split(/\s|\n|,|;/g)
          .map((s) => s.trim())
          .filter((s) => {
            if (!s) return false;
            try {
              new URL(s);
              return true;
            } catch {
              return false;
            }
          }),
      ),
    );
  }

  function addToQueue() {
    const urls = parseUrls(input);
    if (!urls.length) {
      toast.error("Cole pelo menos um link válido");
      return;
    }
    const existing = new Set(items.map((i) => i.url));
    const fresh = urls.filter((u) => !existing.has(u));
    if (!fresh.length) {
      toast.info("Todos os links já estão na fila");
      setInput("");
      return;
    }
    const now = Date.now();
    setItems((prev) => [
      ...prev,
      ...fresh.map((url, i) => ({
        id: `${now}-${i}`,
        url,
        status: "pending" as const,
      })),
    ]);
    setInput("");
    toast.success(`${fresh.length} link(s) adicionado(s)`);
  }

  async function processQueue() {
    if (running) return;
    setRunning(true);
    try {
      // Process one-by-one to be gentle with rate limits
      // Grab fresh snapshot each iteration
      let queue = items;
      for (const item of queue) {
        if (item.status === "done") continue;
        setItems((prev) =>
          prev.map((it) => (it.id === item.id ? { ...it, status: "loading" } : it)),
        );
        try {
          const data = await analyzeOffer({
            data: { url: item.url, tone, affiliateIds: ids, overrides: {} },
          });
          setItems((prev) => {
            const next = prev.map((it) =>
              it.id === item.id ? { ...it, status: "done" as const, result: data } : it,
            );
            queue = next;
            return next;
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Erro";
          setItems((prev) => {
            const next = prev.map((it) =>
              it.id === item.id ? { ...it, status: "error" as const, error: msg } : it,
            );
            queue = next;
            return next;
          });
          if (msg.includes("429")) {
            toast.error("Rate limit — pausando fila");
            break;
          }
        }
      }
      toast.success("Fila processada");
    } finally {
      setRunning(false);
    }
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function clearDone() {
    setItems((prev) => prev.filter((i) => i.status !== "done"));
  }

  function clearAll() {
    if (!confirm("Limpar toda a fila?")) return;
    setItems([]);
  }

  function togglePosted(id: string, key: "postedWhats" | "postedInsta" | "postedFace") {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [key]: !it[key] } : it)),
    );
  }

  return (
    <div className="min-h-screen">
      <header className="mx-auto max-w-6xl px-6 pt-8 pb-4 flex items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-secondary hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <div className="text-sm text-muted-foreground">
          {stats.done}/{stats.total} prontas · {stats.posted} postadas
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 pt-4 pb-8 text-center">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          Fila de <span className="gradient-text">ofertas do dia</span>
        </h1>
        <p className="mt-3 text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
          Cole vários links de uma vez, gere tudo e vá postando ao longo do dia.
          Marque cada item conforme publica.
        </p>
      </section>

      <main className="mx-auto max-w-4xl px-6 pb-24 space-y-6">
        <div className="card-glass rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ListPlus className="h-4 w-4 text-primary" />
            Cole os links (um por linha, ou separados por espaço/vírgula)
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={"https://amazon.com.br/...\nhttps://magazineluiza.com.br/...\nhttps://mercadolivre.com.br/..."}
            rows={5}
            className="w-full bg-[var(--input)] border border-border rounded-lg p-3 text-sm font-mono focus:outline-none focus:border-primary"
          />

          <div>
            <div className="text-sm font-medium mb-2">Tom das mensagens</div>
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

          <div className="flex flex-wrap gap-2">
            <button
              onClick={addToQueue}
              className="px-4 py-2 rounded-lg bg-secondary hover:bg-muted text-sm font-semibold flex items-center gap-2"
            >
              <ListPlus className="h-4 w-4" /> Adicionar à fila
            </button>
            <button
              onClick={processQueue}
              disabled={running || items.every((i) => i.status === "done")}
              className="btn-hero px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
            >
              {running ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Processando…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Gerar todas as pendentes
                </>
              )}
            </button>
            {items.some((i) => i.status === "done") && (
              <button
                onClick={clearDone}
                className="px-4 py-2 rounded-lg text-sm bg-secondary hover:bg-muted flex items-center gap-2"
              >
                <Check className="h-4 w-4" /> Limpar prontas
              </button>
            )}
            {items.length > 0 && (
              <button
                onClick={clearAll}
                className="px-4 py-2 rounded-lg text-sm bg-secondary hover:bg-muted flex items-center gap-2 text-destructive"
              >
                <Trash2 className="h-4 w-4" /> Limpar tudo
              </button>
            )}
          </div>
        </div>

        {items.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-12">
            Sua fila está vazia. Cole alguns links acima para começar.
          </div>
        )}

        <div className="space-y-4">
          {items.map((item) => (
            <QueueRow
              key={item.id}
              item={item}
              onRemove={() => removeItem(item.id)}
              onTogglePosted={(k) => togglePosted(item.id, k)}
            />
          ))}
        </div>
      </main>
    </div>
  );
}

function QueueRow({
  item,
  onRemove,
  onTogglePosted,
}: {
  item: QueueItem;
  onRemove: () => void;
  onTogglePosted: (k: "postedWhats" | "postedInsta" | "postedFace") => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="card-glass rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <StatusIcon status={item.status} />
        <div className="flex-1 min-w-0">
          {item.result ? (
            <div className="flex items-start gap-3">
              {item.result.product.image && (
                <img
                  src={item.result.product.image}
                  alt=""
                  className="w-14 h-14 rounded object-cover bg-muted flex-shrink-0"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {item.result.platformLabel}
                </div>
                <div className="text-sm font-semibold leading-snug line-clamp-2">
                  {item.result.product.title}
                </div>
                {item.result.product.price && (
                  <div className="text-primary font-bold text-sm mt-0.5">
                    {item.result.product.price}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-xs truncate text-muted-foreground">{item.url}</div>
          )}
          {item.error && (
            <div className="text-xs text-destructive mt-1">{item.error}</div>
          )}
        </div>
        <button
          onClick={onRemove}
          className="p-2 rounded hover:bg-muted text-muted-foreground"
          title="Remover"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {item.status === "done" && item.result && (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            <ShareBtn
              icon={<MessageCircle className="h-3.5 w-3.5" />}
              label="WhatsApp"
              url={`https://wa.me/?text=${encodeURIComponent(
                buildText(item.result.captions.whatsapp, item.result.affiliateUrl, []),
              )}`}
              posted={!!item.postedWhats}
              onTogglePosted={() => onTogglePosted("postedWhats")}
            />
            <ShareBtn
              icon={<Instagram className="h-3.5 w-3.5" />}
              label="Instagram"
              copyText={buildText(
                item.result.captions.instagram,
                item.result.affiliateUrl,
                item.result.captions.hashtags,
              )}
              posted={!!item.postedInsta}
              onTogglePosted={() => onTogglePosted("postedInsta")}
            />
            <ShareBtn
              icon={<Facebook className="h-3.5 w-3.5" />}
              label="Facebook"
              url={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
                item.result.affiliateUrl,
              )}`}
              copyText={buildText(item.result.captions.facebook, item.result.affiliateUrl, [])}
              posted={!!item.postedFace}
              onTogglePosted={() => onTogglePosted("postedFace")}
            />
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-xs px-3 py-1.5 rounded bg-secondary hover:bg-muted"
            >
              {expanded ? "Ocultar" : "Ver legendas"}
            </button>
            <a
              href={item.result.affiliateUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-3 py-1.5 rounded bg-secondary hover:bg-muted flex items-center gap-1"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Link
            </a>
          </div>

          {expanded && (
            <div className="mt-3 space-y-2">
              <CaptionBlock
                label="WhatsApp"
                text={buildText(item.result.captions.whatsapp, item.result.affiliateUrl, [])}
              />
              <CaptionBlock
                label="Instagram"
                text={buildText(
                  item.result.captions.instagram,
                  item.result.affiliateUrl,
                  item.result.captions.hashtags,
                )}
              />
              <CaptionBlock
                label="Facebook"
                text={buildText(item.result.captions.facebook, item.result.affiliateUrl, [])}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: QueueItem["status"] }) {
  if (status === "loading") return <Loader2 className="h-5 w-5 animate-spin text-primary mt-0.5" />;
  if (status === "done") return <CheckCircle2 className="h-5 w-5 text-green-400 mt-0.5" />;
  if (status === "error") return <Circle className="h-5 w-5 text-destructive mt-0.5" />;
  return <Circle className="h-5 w-5 text-muted-foreground mt-0.5" />;
}

function ShareBtn({
  icon,
  label,
  url,
  copyText,
  posted,
  onTogglePosted,
}: {
  icon: React.ReactNode;
  label: string;
  url?: string;
  copyText?: string;
  posted: boolean;
  onTogglePosted: () => void;
}) {
  async function handleClick() {
    if (copyText) {
      try {
        await navigator.clipboard.writeText(copyText);
        toast.success(`Legenda do ${label} copiada`);
      } catch {
        // ignore
      }
    }
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    if (!posted) onTogglePosted();
  }
  return (
    <div className="flex items-center rounded overflow-hidden border border-border">
      <button
        onClick={handleClick}
        className={`text-xs px-3 py-1.5 flex items-center gap-1.5 transition ${
          posted ? "bg-green-500/15 text-green-300" : "bg-secondary hover:bg-muted"
        }`}
      >
        {icon}
        {label}
        {copyText && !url && <Copy className="h-3 w-3 ml-0.5 opacity-70" />}
        {url && <ExternalLink className="h-3 w-3 ml-0.5 opacity-70" />}
      </button>
      <button
        onClick={onTogglePosted}
        className={`px-2 py-1.5 border-l border-border transition ${
          posted ? "bg-green-500/25 text-green-300" : "bg-secondary hover:bg-muted text-muted-foreground"
        }`}
        title={posted ? "Marcada como postada" : "Marcar como postada"}
      >
        <Check className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function CaptionBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-lg bg-muted/40 p-3">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            toast.success(`${label} copiado`);
          }}
          className="text-[11px] px-2 py-1 rounded bg-secondary hover:bg-muted flex items-center gap-1"
        >
          <Copy className="h-3 w-3" /> Copiar
        </button>
      </div>
      <div className="text-xs whitespace-pre-wrap leading-relaxed">{text}</div>
    </div>
  );
}

function buildText(base: string, url: string, hashtags: string[]): string {
  const hasUrl = base.includes(url);
  const parts = [base.trim()];
  if (!hasUrl) parts.push(`\n👉 ${url}`);
  if (hashtags.length) parts.push("\n\n" + hashtags.map((h) => `#${h}`).join(" "));
  return parts.join("");
}
