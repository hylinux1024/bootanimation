import JSZip from 'jszip';
import type { BootanimationConfig, GifFrame } from './types';
import { generateDesc } from './desc';
import { frameToImage } from './gif';

export interface ProgressCallback {
  (stage: string, current: number, total: number): void;
}

/**
 * Generate a bootanimation.zip from decoded GIF frames.
 */
export async function generateBootanimationZip(
  frames: GifFrame[],
  config: BootanimationConfig,
  onProgress?: ProgressCallback,
): Promise<Blob> {
  const zip = new JSZip();

  // Apply frame skip
  const sampled: GifFrame[] = [];
  for (let i = 0; i < frames.length; i += config.frameSkip) {
    sampled.push(frames[i]);
  }

  const ext = config.format === 'jpeg' ? 'jpg' : 'png';

  // Calculate split point for two-part animation
  const splitIndex = config.singlePart ? sampled.length : Math.ceil(sampled.length * 0.6);

  // Process part0
  const part0Folder = zip.folder('part0')!;
  for (let i = 0; i < splitIndex; i++) {
    onProgress?.('part0', i + 1, splitIndex);
    const blob = await frameToImage(sampled[i], config.width, config.height, config.format, config.jpegQuality);
    const filename = `${String(i).padStart(3, '0')}.${ext}`;
    part0Folder.file(filename, blob);
  }

  // Process part1 (if not single part)
  if (!config.singlePart && splitIndex < sampled.length) {
    const part1Folder = zip.folder('part1')!;
    for (let i = splitIndex; i < sampled.length; i++) {
      onProgress?.('part1', i - splitIndex + 1, sampled.length - splitIndex);
      const blob = await frameToImage(sampled[i], config.width, config.height, config.format, config.jpegQuality);
      const filename = `${String(i - splitIndex).padStart(3, '0')}.${ext}`;
      part1Folder.file(filename, blob);
    }
  }

  // Add desc.txt
  const descContent = generateDesc(config);
  zip.file('desc.txt', descContent);

  // Android requires STORE (no compression), equivalent to zip -0
  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'STORE',
  });
  return blob;
}
