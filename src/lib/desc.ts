import type { BootanimationConfig } from './types';

/**
 * Generate the content of desc.txt for a bootanimation.zip.
 *
 * Format:
 *   <width> <height> <fps>
 *   p <loop> <pause> <folder>
 *
 * For single part: part0 loops forever (loop=0)
 * For two parts: part0 loops forever, part1 plays once (loop=1)
 */
export function generateDesc(config: BootanimationConfig): string {
  const { width, height, fps } = config;

  const lines: string[] = [
    `${width} ${height} ${fps}`,
  ];

  if (config.singlePart) {
    lines.push('p 0 0 part0');
  } else {
    lines.push('p 0 0 part0');
    lines.push('p 1 0 part1');
  }

  return lines.join('\n') + '\n';
}
