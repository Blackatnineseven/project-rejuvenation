// Client-side Reels/Shorts video generator (1080x1920 vertical, ~8s).
// Uses Canvas + MediaRecorder to produce a video Blob (mp4 when supported, else webm).

export type ReelInput = {
  title: string;
  price?: string;
  image?: string;
  platformLabel: string;
  badge?: string;
  cta?: string;
};

export type ReelOutput = {
  blob: Blob;
  mimeType: string;
  extension: "mp4" | "webm";
  url: string;
};

const W = 1080;
const H = 1920;
const FPS = 30;
const DURATION_SEC = 8;
const TOTAL_FRAMES = FPS * DURATION_SEC;

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const test = current ? current + " " + w : w;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = w;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines) {
    let last = lines[maxLines - 1];
    while (ctx.measureText(last + "…").width > maxWidth && last.length > 0) {
      last = last.slice(0, -1);
    }
    lines[maxLines - 1] = last + "…";
  }
  return lines;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function pickMimeType(): { mime: string; ext: "mp4" | "webm" } {
  const candidates: Array<{ mime: string; ext: "mp4" | "webm" }> = [
    { mime: "video/mp4;codecs=avc1.42E01E", ext: "mp4" },
    { mime: "video/mp4", ext: "mp4" },
    { mime: "video/webm;codecs=vp9", ext: "webm" },
    { mime: "video/webm;codecs=vp8", ext: "webm" },
    { mime: "video/webm", ext: "webm" },
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c.mime)) {
      return c;
    }
  }
  return { mime: "video/webm", ext: "webm" };
}

export async function renderOfferReel(input: ReelInput): Promise<ReelOutput> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D não suportado");

  const productImg = input.image ? await loadImage(input.image) : null;

  const { mime, ext } = pickMimeType();
  const stream = canvas.captureStream(FPS);
  const recorder = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: 6_000_000,
  });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const done = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  recorder.start();

  const badgeText = (input.badge || "OFERTA").toUpperCase();
  const cta = (input.cta || "LINK NA BIO 👆").toUpperCase();

  // Pre-compute title lines with a scratch font
  ctx.font = "bold 74px system-ui, -apple-system, 'Segoe UI', sans-serif";
  const titleLines = wrapText(ctx, input.title, W - 160, 3);

  const startTs = performance.now();

  await new Promise<void>((resolve) => {
    let frame = 0;

    function draw() {
      const t = frame / TOTAL_FRAMES; // 0..1

      // Background
      const bg = ctx!.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, "#1a1020");
      bg.addColorStop(1, "#0d0715");
      ctx!.fillStyle = bg;
      ctx!.fillRect(0, 0, W, H);

      // Animated blobs (drift)
      const drift = Math.sin(t * Math.PI * 2) * 60;
      const glow = ctx!.createRadialGradient(
        W * 0.15 + drift,
        H * 0.1,
        0,
        W * 0.15 + drift,
        H * 0.1,
        900,
      );
      glow.addColorStop(0, "rgba(249, 115, 22, 0.45)");
      glow.addColorStop(1, "rgba(249, 115, 22, 0)");
      ctx!.fillStyle = glow;
      ctx!.fillRect(0, 0, W, H);

      const glow2 = ctx!.createRadialGradient(
        W * 0.9 - drift,
        H * 0.9,
        0,
        W * 0.9 - drift,
        H * 0.9,
        900,
      );
      glow2.addColorStop(0, "rgba(217, 70, 239, 0.4)");
      glow2.addColorStop(1, "rgba(217, 70, 239, 0)");
      ctx!.fillStyle = glow2;
      ctx!.fillRect(0, 0, W, H);

      // === Product image card with Ken Burns ===
      const cardX = 80;
      const cardY = 240;
      const cardW = W - 160;
      const cardH = 1080;

      ctx!.save();
      roundRect(ctx!, cardX, cardY, cardW, cardH, 60);
      ctx!.fillStyle = "#ffffff";
      ctx!.fill();
      ctx!.clip();

      if (productImg) {
        // Ken Burns: slow zoom-in from 1.0 to 1.12
        const zoom = 1.0 + t * 0.12;
        const pan = Math.sin(t * Math.PI) * 20;
        const pad = 60;
        const innerW = cardW - pad * 2;
        const innerH = cardH - pad * 2;
        const ratio = Math.min(innerW / productImg.width, innerH / productImg.height) * zoom;
        const iw = productImg.width * ratio;
        const ih = productImg.height * ratio;
        ctx!.drawImage(
          productImg,
          cardX + (cardW - iw) / 2 + pan,
          cardY + (cardH - ih) / 2,
          iw,
          ih,
        );
      } else {
        ctx!.fillStyle = "#f3f4f6";
        ctx!.fillRect(cardX, cardY, cardW, cardH);
        ctx!.fillStyle = "#9ca3af";
        ctx!.font = "600 48px system-ui, sans-serif";
        ctx!.textAlign = "center";
        ctx!.textBaseline = "middle";
        ctx!.fillText("SEM IMAGEM", cardX + cardW / 2, cardY + cardH / 2);
        ctx!.textAlign = "left";
      }
      ctx!.restore();

      // === Top: platform label ===
      ctx!.font = "700 34px system-ui, sans-serif";
      ctx!.fillStyle = "rgba(255,255,255,0.75)";
      ctx!.textBaseline = "middle";
      ctx!.textAlign = "center";
      ctx!.fillText(input.platformLabel.toUpperCase(), W / 2, 130);
      ctx!.textAlign = "left";

      // === Badge: rotating slightly, entry from left ===
      const badgeEnter = easeOutCubic(Math.min(1, t / 0.15));
      const rot = Math.sin(t * Math.PI * 3) * 0.05;
      ctx!.save();
      ctx!.font = "bold 52px system-ui, sans-serif";
      const badgeW = ctx!.measureText(badgeText).width + 70;
      const badgeH = 92;
      const badgeCX = cardX + 30 + (badgeEnter - 1) * 400 + badgeW / 2;
      const badgeCY = cardY - 10;
      ctx!.translate(badgeCX, badgeCY);
      ctx!.rotate(rot - 0.08);
      const bGrad = ctx!.createLinearGradient(-badgeW / 2, 0, badgeW / 2, 0);
      bGrad.addColorStop(0, "#f97316");
      bGrad.addColorStop(1, "#d946ef");
      ctx!.fillStyle = bGrad;
      roundRect(ctx!, -badgeW / 2, -badgeH / 2, badgeW, badgeH, badgeH / 2);
      ctx!.fill();
      ctx!.fillStyle = "#ffffff";
      ctx!.textBaseline = "middle";
      ctx!.textAlign = "center";
      ctx!.fillText(badgeText, 0, 4);
      ctx!.restore();
      ctx!.textAlign = "left";

      // === Title (fades/slides in) ===
      const titleEnter = easeOutCubic(Math.min(1, Math.max(0, (t - 0.1) / 0.25)));
      ctx!.globalAlpha = titleEnter;
      ctx!.font = "bold 74px system-ui, sans-serif";
      ctx!.fillStyle = "#ffffff";
      ctx!.textBaseline = "top";
      let ty = cardY + cardH + 60 + (1 - titleEnter) * 40;
      for (const line of titleLines) {
        ctx!.fillText(line, 80, ty);
        ty += 88;
      }
      ctx!.globalAlpha = 1;

      // === Price (pulses) ===
      if (input.price) {
        const priceEnter = easeOutCubic(Math.min(1, Math.max(0, (t - 0.3) / 0.2)));
        const pulse = 1 + Math.sin(t * Math.PI * 6) * 0.03;
        ctx!.save();
        const px = 80;
        const py = ty + 40;
        ctx!.translate(px, py);
        ctx!.scale(pulse * priceEnter + (1 - priceEnter) * 0.6, pulse * priceEnter + (1 - priceEnter) * 0.6);
        ctx!.globalAlpha = priceEnter;
        ctx!.font = "900 130px system-ui, sans-serif";
        const priceGrad = ctx!.createLinearGradient(0, 0, 700, 0);
        priceGrad.addColorStop(0, "#fb923c");
        priceGrad.addColorStop(1, "#e879f9");
        ctx!.fillStyle = priceGrad;
        ctx!.textBaseline = "top";
        ctx!.fillText(input.price, 0, 0);
        ctx!.restore();
        ctx!.globalAlpha = 1;
      }

      // === CTA at bottom (bouncing) ===
      const ctaEnter = easeOutCubic(Math.min(1, Math.max(0, (t - 0.5) / 0.2)));
      const bounce = Math.sin(t * Math.PI * 4) * 6;
      ctx!.globalAlpha = ctaEnter;
      ctx!.font = "800 56px system-ui, sans-serif";
      ctx!.textAlign = "center";
      ctx!.textBaseline = "middle";
      const ctaY = H - 140 + bounce;
      const ctaMetrics = ctx!.measureText(cta);
      const ctaBoxW = ctaMetrics.width + 100;
      const ctaBoxH = 110;
      const ctaGrad = ctx!.createLinearGradient(
        W / 2 - ctaBoxW / 2,
        ctaY,
        W / 2 + ctaBoxW / 2,
        ctaY,
      );
      ctaGrad.addColorStop(0, "#f97316");
      ctaGrad.addColorStop(1, "#d946ef");
      ctx!.fillStyle = ctaGrad;
      roundRect(ctx!, W / 2 - ctaBoxW / 2, ctaY - ctaBoxH / 2, ctaBoxW, ctaBoxH, ctaBoxH / 2);
      ctx!.fill();
      ctx!.fillStyle = "#ffffff";
      ctx!.fillText(cta, W / 2, ctaY + 4);
      ctx!.globalAlpha = 1;

      // === Brand ===
      ctx!.font = "700 32px system-ui, sans-serif";
      ctx!.fillStyle = "rgba(255,255,255,0.55)";
      ctx!.textAlign = "center";
      ctx!.textBaseline = "bottom";
      ctx!.fillText("✨ AchouAI", W / 2, H - 40);

      // Reset defaults
      ctx!.textAlign = "left";
      ctx!.textBaseline = "alphabetic";

      frame++;
      if (frame >= TOTAL_FRAMES) {
        resolve();
        return;
      }

      // Pace roughly to real time so MediaRecorder captures correctly
      const target = startTs + (frame * 1000) / FPS;
      const now = performance.now();
      const delay = Math.max(0, target - now);
      setTimeout(() => requestAnimationFrame(draw), delay);
    }

    draw();
  });

  recorder.stop();
  await done;

  const blob = new Blob(chunks, { type: mime });
  const url = URL.createObjectURL(blob);
  return { blob, mimeType: mime, extension: ext, url };
}
