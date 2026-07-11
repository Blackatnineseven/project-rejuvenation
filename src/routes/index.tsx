import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, Copy, Check, Loader2, Wand2 } from "lucide-react";
import { generateContent, type GeneratedContent } from "@/lib/content.functions";

export const Route = createFileRoute("/")({
  component: Index,
});

type Tone = "urgente" | "amigavel" | "profissional" | "divertido";

function Index() {
  const [productName, setProductName] = useState("");
  const [price, setPrice] = useState("");
  const [platform, setPlatform] = useState("");
  const [category, setCategory] = useState("");
  const [url, setUrl] = useState("");
  const [tone, setTone] = useState<Tone>("urgente");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GeneratedContent | null>(null);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!productName.trim()) {
      toast.error("Informe o nome do produto");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const parsedPrice = price ? parseFloat(price.replace(",", ".")) : undefined;
      const data = await generateContent({
        data: {
          productName: productName.trim(),
          price: Number.isFinite(parsedPrice) ? parsedPrice : undefined,
          platform: platform.trim() || undefined,
          category: category.trim() || undefined,
          url: url.trim() || undefined,
          tone,
        },
      });
      setResult(data);
      toast.success("Conteúdo gerado!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao gerar conteúdo";
      if (msg.includes("429")) toast.error("Muitas requisições. Aguarde alguns segundos.");
      else if (msg.includes("402")) toast.error("Créditos de IA esgotados. Adicione créditos no workspace.");
      else toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="mx-auto max-w-6xl px-6 pt-10 pb-6">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl btn-hero">
            <Sparkles className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold">AchouAI</span>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 pt-6 pb-10 text-center">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
          Posts de ofertas <span className="gradient-text">irresistíveis</span>
          <br />gerados por IA
        </h1>
        <p className="mt-5 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
          Descreva a oferta e receba título, copy completa, hashtags e roteiro
          de Reels em segundos. Feito para afiliados.
        </p>
      </section>

      <main className="mx-auto max-w-6xl px-6 pb-24 grid gap-8 lg:grid-cols-2">
        <form onSubmit={handleGenerate} className="card-glass rounded-2xl p-6 md:p-8 space-y-5">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Dados da oferta
          </h2>

          <Field label="Nome do produto *" htmlFor="productName">
            <input
              id="productName"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Ex: Fone Bluetooth JBL Tune 510BT"
              className="input"
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Preço (R$)" htmlFor="price">
              <input
                id="price"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="199,90"
                inputMode="decimal"
                className="input"
              />
            </Field>
            <Field label="Plataforma" htmlFor="platform">
              <input
                id="platform"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                placeholder="Amazon, Shopee..."
                className="input"
              />
            </Field>
          </div>

          <Field label="Categoria" htmlFor="category">
            <input
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Eletrônicos, moda, casa..."
              className="input"
            />
          </Field>

          <Field label="Link de afiliado" htmlFor="url">
            <input
              id="url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="input"
            />
          </Field>

          <Field label="Tom da mensagem" htmlFor="tone">
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
          </Field>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-hero rounded-lg px-5 py-3 font-semibold flex items-center justify-center gap-2"
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Gerando…</>
            ) : (
              <><Sparkles className="h-4 w-4" /> Gerar conteúdo</>
            )}
          </button>
        </form>

        <div className="space-y-5">
          {!result && !loading && (
            <div className="card-glass rounded-2xl p-8 text-center text-muted-foreground min-h-[400px] flex flex-col items-center justify-center">
              <Sparkles className="h-10 w-10 mb-3 text-primary/60" />
              <p className="font-medium">Seu post aparece aqui</p>
              <p className="text-sm mt-1">Preencha os dados e clique em Gerar</p>
            </div>
          )}

          {loading && (
            <div className="card-glass rounded-2xl p-8 text-center min-h-[400px] flex flex-col items-center justify-center">
              <Loader2 className="h-10 w-10 mb-3 animate-spin text-primary" />
              <p className="font-medium">A IA está pensando…</p>
            </div>
          )}

          {result && (
            <>
              <ResultCard label="Título" text={result.title} />
              <ResultCard label="Post" text={result.post} multiline />
              <ResultCard
                label="Hashtags"
                text={result.hashtags.map((h) => `#${h}`).join(" ")}
              />
              <ResultCard label="Roteiro para Reels" text={result.script} multiline />
            </>
          )}
        </div>
      </main>

      <style>{`
        .input {
          width: 100%;
          background: var(--input);
          border: 1px solid var(--border);
          border-radius: 0.5rem;
          padding: 0.65rem 0.85rem;
          font-size: 0.925rem;
          color: var(--foreground);
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .input:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px oklch(0.72 0.19 45 / 0.15); }
      `}</style>
    </div>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function ResultCard({ label, text, multiline }: { label: string; text: string; multiline?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(`${label} copiado`);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="card-glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{label}</h3>
        <button
          onClick={copy}
          className="text-xs flex items-center gap-1 px-2 py-1 rounded hover:bg-muted transition"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <div className={`text-sm ${multiline ? "whitespace-pre-wrap" : ""} leading-relaxed`}>
        {text}
      </div>
    </div>
  );
}
