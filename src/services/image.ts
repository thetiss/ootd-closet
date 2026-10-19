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
