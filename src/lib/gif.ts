import { parseGIF, decompressFrames } from 'gifuct-js';
import type { GifFrame, ImageFormat } from './types';

/**
 * Decode a GIF file into an array of RGBA frames.
 */
export async function decodeGif(file: File): Promise<GifFrame[]> {
  const buffer = await file.arrayBuffer();
  const parsed = parseGIF(buffer);
  const frames = decompressFrames(parsed, true);

  const canvas = document.createElement('canvas');
  canvas.width = parsed.lsd.width;
  canvas.height = parsed.lsd.height;
  const ctx = canvas.getContext('2d')!;

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = parsed.lsd.width;
  tempCanvas.height = parsed.lsd.height;
  const tempCtx = tempCanvas.getContext('2d')!;

  const result: GifFrame[] = [];

  for (const frame of frames) {
    const { dims, patch, delay } = frame;

    // Dispose previous frame
    if (frame.disposalType === 2) {
      tempCtx.clearRect(dims.left, dims.top, dims.width, dims.height);
    }

    // Draw this frame's patch onto the temp canvas
    const imageData = new ImageData(patch as Uint8ClampedArray<ArrayBuffer>, dims.width, dims.height);
    canvas.width = dims.width;
    canvas.height = dims.height;
    ctx.putImageData(imageData, 0, 0);
    tempCtx.drawImage(canvas, dims.left, dims.top);

    // Extract full-frame RGBA
    const fullImageData = tempCtx.getImageData(0, 0, parsed.lsd.width, parsed.lsd.height);

    result.push({
      data: fullImageData,
      delay: delay || 100,
      width: parsed.lsd.width,
      height: parsed.lsd.height,
    });
  }

  return result;
}

/**
 * Convert a GifFrame to an image Blob at the target resolution.
 * Supports PNG (lossless) and JPEG (lossy, quality-controlled).
 */
export async function frameToImage(
  frame: GifFrame,
  targetWidth: number,
  targetHeight: number,
  format: ImageFormat,
  jpegQuality: number,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d')!;

  // Draw the original frame scaled
  const source = document.createElement('canvas');
  source.width = frame.width;
  source.height = frame.height;
  const sourceCtx = source.getContext('2d')!;
  sourceCtx.putImageData(frame.data, 0, 0);

  ctx.drawImage(source, 0, 0, targetWidth, targetHeight);

  const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const quality = format === 'jpeg' ? jpegQuality : undefined;

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error(`Failed to create ${format.toUpperCase()} blob`));
    }, mimeType, quality);
  });
}
