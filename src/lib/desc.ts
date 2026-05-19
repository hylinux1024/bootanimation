import type { BootanimationConfig } from './types';

/**
 * Generate the content of desc.txt for a bootanimation.zip.
 *
 * Format:
 *   <width> <height> <fps>
 *   p <loop> <pause> <folder>
 *
 * part0: loops forever (loop=0)
 * part1: plays once (loop=1), only included when hasPart1=true
 */
export function generateDesc(config: BootanimationConfig, hasPart1 = false): string {
  const { width, height, fps } = config;

  const lines: string[] = [
    `${width} ${height} ${fps}`,
    'p 0 0 part0',
  ];

  if (hasPart1) {
    lines.push('p 1 0 part1');
  }

  return lines.join('\n') + '\n';
}
