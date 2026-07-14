// Renders a shareable offer card (1080x1350 - Instagram feed 4:5) to a canvas.
// Returns a data URL. Works fully client-side.

export type CardInput = {
  title: string;
  price?: string;
  image?: string;
  platformLabel: string;
  badge?: string; // e.g. "OFERTA", "PROMO", "-30%"
};

const W = 1080;
const H = 1350;

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const ratio = Math.max(w / img.width, h / img.height);
  const iw = img.width * ratio;
  const ih = img.height * ratio;
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}

function drawContain(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const ratio = Math.min(w / img.width, h / img.height);
  const iw = img.width * ratio;
  const ih = img.height * ratio;
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
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

export async function renderOfferCard(input: CardInput): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Background gradient (matches app: orange -> magenta)
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#1a1020");
  bg.addColorStop(1, "#0d0715");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Decorative blurred blob
  const glow = ctx.createRadialGradient(W * 0.15, H * 0.05, 0, W * 0.15, H * 0.05, 700);
  glow.addColorStop(0, "rgba(249, 115, 22, 0.35)");
  glow.addColorStop(1, "rgba(249, 115, 22, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const glow2 = ctx.createRadialGradient(W * 0.9, H * 0.95, 0, W * 0.9, H * 0.95, 700);
  glow2.addColorStop(0, "rgba(217, 70, 239, 0.35)");
  glow2.addColorStop(1, "rgba(217, 70, 239, 0)");
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, W, H);

  // Product image area (rounded card, white bg for product on white)
  const imgX = 80;
  const imgY = 120;
  const imgW = W - 160;
  const imgH = 720;

  ctx.save();
  roundRect(ctx, imgX, imgY, imgW, imgH, 40);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.clip();

  if (input.image) {
    const img = await loadImage(input.image);
    if (img) {
      // If image looks non-white bg (marketplace photo), use contain with padding
      drawContain(ctx, img, imgX + 40, imgY + 40, imgW - 80, imgH - 80);
    } else {
      ctx.fillStyle = "#f3f4f6";
      ctx.fillRect(imgX, imgY, imgW, imgH);
    }
  } else {
    ctx.fillStyle = "#f3f4f6";
    ctx.fillRect(imgX, imgY, imgW, imgH);
  }
  ctx.restore();

  // Badge (top-left, floating over image card)
  const badgeText = (input.badge || "OFERTA").toUpperCase();
  ctx.font = "bold 42px system-ui, -apple-system, 'Segoe UI', sans-serif";
  const badgeW = ctx.measureText(badgeText).width + 60;
  const badgeH = 72;
  const badgeX = imgX - 10;
  const badgeY = imgY - 30;

  const badgeGrad = ctx.createLinearGradient(badgeX, badgeY, badgeX + badgeW, badgeY);
  badgeGrad.addColorStop(0, "#f97316");
  badgeGrad.addColorStop(1, "#d946ef");
  ctx.fillStyle = badgeGrad;
  roundRect(ctx, badgeX, badgeY, badgeW, badgeH, badgeH / 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "middle";
  ctx.fillText(badgeText, badgeX + 30, badgeY + badgeH / 2 + 2);

  // Platform label (small, top-right)
  ctx.font = "600 26px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(input.platformLabel.toUpperCase(), W - 90, imgY - 30 + badgeH / 2);
  ctx.textAlign = "left";

  // Title
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 52px system-ui, sans-serif";
  ctx.textBaseline = "top";
  const titleLines = wrapText(ctx, input.title, W - 160, 3);
  let ty = imgY + imgH + 60;
  for (const line of titleLines) {
    ctx.fillText(line, 80, ty);
    ty += 64;
  }

  // Price
  if (input.price) {
    ctx.font = "800 92px system-ui, sans-serif";
    const priceGrad = ctx.createLinearGradient(80, ty + 30, W - 80, ty + 30);
    priceGrad.addColorStop(0, "#fb923c");
    priceGrad.addColorStop(1, "#e879f9");
    ctx.fillStyle = priceGrad;
    ctx.fillText(input.price, 80, ty + 30);
  }

  // Footer brand
  ctx.font = "700 30px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.textBaseline = "bottom";
  ctx.fillText("✨ AchouAI", 80, H - 60);

  ctx.textAlign = "right";
  ctx.fillText("Link nos comentários 👇", W - 80, H - 60);

  return canvas.toDataURL("image/png");
}
