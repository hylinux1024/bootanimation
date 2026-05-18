export interface GifFrame {
  /** RGBA pixel data */
  data: ImageData;
  /** Delay in milliseconds */
  delay: number;
  /** Frame dimensions */
  width: number;
  height: number;
}

export type ImageFormat = 'png' | 'jpeg';

export interface BootanimationConfig {
  width: number;
  height: number;
  fps: number;
  /** true = single part (looping), false = two parts (loop + stop) */
  singlePart: boolean;
  /** Output image format */
  format: ImageFormat;
  /** JPEG quality (0.1–1.0), only used when format='jpeg' */
  jpegQuality: number;
  /** Keep 1 frame every N frames (1 = keep all) */
  frameSkip: number;
}

export type ProcessingStatus = 'idle' | 'loading' | 'processing' | 'done' | 'error';
