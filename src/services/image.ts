// Canvas API 图片压缩
export interface ProcessedImage {
  full: Blob;
  thumb: Blob;
}

async function compressToBlob(
  file: File,
  longEdge: number,
  quality: number,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, longEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cannot get canvas 2d context');
  ctx.drawImage(bitmap, 0, 0, w, h);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob failed'));
      },
      'image/jpeg',
      quality,
    );
  });
}

export async function compressImage(
  file: File,
  opts?: { fullLongEdge?: number; thumbLongEdge?: number; quality?: number },
): Promise<ProcessedImage> {
  const fullLongEdge = opts?.fullLongEdge ?? 800;
  const thumbLongEdge = opts?.thumbLongEdge ?? 300;
  const quality = opts?.quality ?? 0.75;
  const [full, thumb] = await Promise.all([
    compressToBlob(file, fullLongEdge, quality),
    compressToBlob(file, thumbLongEdge, quality),
  ]);
  return { full, thumb };
}

export interface CompositeSlot {
  blob: Blob | null;
  label: string;
  icon: string;
}

/**
 * 把 4 件套合成一张 2x2 效果图（每格一个单品，空槽画占位）。
 * 用于 Look 的 sourcePhoto，无需用户手动传整套照。
 */
export async function compositeOutfitImage(
  slots: CompositeSlot[],
  opts: { cellSize?: number; quality?: number } = {},
): Promise<Blob> {
  const cellSize = opts.cellSize ?? 420;
  const quality = opts.quality ?? 0.8;
  const cols = 2;
  const rows = Math.ceil(Math.max(1, slots.length) / cols);
  const w = cols * cellSize;
  const h = rows * cellSize;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cannot get canvas 2d context');

  // 底色：呼应设计系统的 paper 色调
  ctx.fillStyle = '#F5F1E8';
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * cellSize;
    const y = row * cellSize;

    if (s.blob) {
      const url = URL.createObjectURL(s.blob);
      try {
        const img = await loadImageElement(url);
        drawImageCover(ctx, img, x, y, cellSize, cellSize);
      } catch {
        drawPlaceholder(ctx, x, y, cellSize, s.label, s.icon);
      } finally {
        URL.revokeObjectURL(url);
      }
    } else {
      drawPlaceholder(ctx, x, y, cellSize, s.label, s.icon);
    }
  }

  // 分隔线
  ctx.strokeStyle = 'rgba(30, 58, 138, 0.10)';
  ctx.lineWidth = 2;
  for (let c = 1; c < cols; c++) {
    ctx.beginPath();
    ctx.moveTo(c * cellSize, 0);
    ctx.lineTo(c * cellSize, h);
    ctx.stroke();
  }
  for (let r = 1; r < rows; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * cellSize);
    ctx.lineTo(w, r * cellSize);
    ctx.stroke();
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
      'image/jpeg',
      quality,
    );
  });
}

/**
 * 把 4 件套合成一张"扁平铺陈"效果图（1:1，无分隔线、无标签），
 * 用于每日穿搭预览卡等需要"一张成套图"的场景。
 * 布局：top 上半 · bottom 下半 · shoes_bags 右下角 · accessory 右上角小叠。
 * 空槽静默跳过，不画占位。
 */
export async function composeOutfitFlat(
  slots: CompositeSlot[],
  opts: { size?: number; quality?: number } = {},
): Promise<Blob> {
  const size = opts.size ?? 560;
  const quality = opts.quality ?? 0.8;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cannot get canvas 2d context');

  ctx.fillStyle = '#F5F1E8';
  ctx.fillRect(0, 0, size, size);

  const regionFor = (i: number): [number, number, number, number] => {
    switch (i) {
      case 0: return [0, 0, size, size * 0.55];             // top
      case 1: return [0, size * 0.45, size, size * 0.55];  // bottom
      case 2: return [size * 0.32, size * 0.6, size * 0.68, size * 0.4];  // shoes_bags
      case 3: return [size * 0.66, size * 0.02, size * 0.32, size * 0.3]; // accessory
      default: return [0, 0, 0, 0];
    }
  };

  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    if (!s.blob) continue;
    const [x, y, w, h] = regionFor(i);
    if (w <= 0 || h <= 0) continue;
    const url = URL.createObjectURL(s.blob);
    try {
      const img = await loadImageElement(url);
      drawImageCover(ctx, img, x, y, w, h);
    } catch {
      // 静默跳过
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
      'image/jpeg',
      quality,
    );
  });
}

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;
  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;
  if (imgRatio > boxRatio) {
    sw = img.height * boxRatio;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / boxRatio;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function drawPlaceholder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  label: string,
  icon: string,
) {
  ctx.fillStyle = '#E8E1D0';
  ctx.fillRect(x, y, size, size);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${Math.floor(size * 0.30)}px serif`;
  ctx.fillText(icon, x + size / 2, y + size / 2 - 14);
  ctx.fillStyle = '#7a7364';
  ctx.font = `600 ${Math.floor(size * 0.075)}px "PingFang SC", "Microsoft YaHei", sans-serif`;
  ctx.fillText(label, x + size / 2, y + size / 2 + 60);
}

export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function dataURLToBlob(dataURL: string): Blob {
  const [header, base64] = dataURL.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'application/octet-stream';
  const bin = atob(base64);
  const len = bin.length;
  const arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
