import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { saveAs } from 'file-saver';
import { decodeGif } from './lib/gif';
import { generateBootanimationZip } from './lib/zip';
import type { GifFrame, BootanimationConfig, ImageFormat, ProcessingStatus } from './lib/types';

const RES_PRESETS = [
  { label: '保持原尺寸', value: 'keep' as const },
  { label: '1080p (1920×1080)', value: '1080p' as const },
  { label: '720p (1280×720)', value: '720p' as const },
  { label: '480p (854×480)', value: '480p' as const },
  { label: '自定义', value: 'custom' as const },
];

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [frames, setFrames] = useState<GifFrame[]>([]);
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [error, setError] = useState<string>('');
  const [progress, setProgress] = useState({ stage: '', current: 0, total: 0 });
  const [zipSize, setZipSize] = useState<number>(0);

  // Config
  const [resMode, setResMode] = useState<string>('keep');
  const [customW, setCustomW] = useState(1920);
  const [customH, setCustomH] = useState(1080);
  const [fps, setFps] = useState(15);
  const [singlePart, setSinglePart] = useState(false);
  const [format, setFormat] = useState<ImageFormat>('jpeg');
  const [jpegQuality, setJpegQuality] = useState(0.7);
  const [frameSkip, setFrameSkip] = useState(1);

  // GIF animated preview
  const previewRef = useRef<HTMLImageElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  const [dragOver, setDragOver] = useState(false);
  const [previewFrame, setPreviewFrame] = useState(0);

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFile = useCallback(async (f: File) => {
    if (f.type !== 'image/gif') {
      setError('请上传 GIF 文件');
      setStatus('error');
      return;
    }
    setFile(f);
    setError('');
    setStatus('loading');

    // Create preview URL
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(f);
    setPreviewUrl(url);

    try {
      const decoded = await decodeGif(f);
      setFrames(decoded);
      setStatus('idle');

      // Auto set resolution to original
      if (decoded.length > 0) {
        setCustomW(decoded[0].width);
        setCustomH(decoded[0].height);
      }
    } catch (e) {
      setStatus('error');
      setError(`GIF 解析失败: ${(e as Error).message}`);
    }
  }, [previewUrl]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const getConfig = useCallback((): BootanimationConfig => {
    let width: number, height: number;
    const originW = frames[0]?.width ?? 1920;
    const originH = frames[0]?.height ?? 1080;

    switch (resMode) {
      case '1080p':
        width = 1920; height = 1080; break;
      case '720p':
        width = 1280; height = 720; break;
      case '480p':
        width = 854; height = 480; break;
      case 'custom':
        width = customW; height = customH; break;
      default: // keep
        width = originW; height = originH; break;
    }

    return { width, height, fps, singlePart, format, jpegQuality, frameSkip };
  }, [frames, resMode, customW, customH, fps, singlePart, format, jpegQuality, frameSkip]);

  // Effective frame count after skip
  const effectiveFrames = useMemo(() => {
    if (frames.length === 0) return 0;
    return Math.ceil(frames.length / frameSkip);
  }, [frames.length, frameSkip]);

  // Estimated size: rough heuristic
  const estimatedSize = useMemo(() => {
    if (frames.length === 0) return null;
    const config = getConfig();
    const pixels = config.width * config.height;
    let bytesPerFrame: number;

    if (config.format === 'jpeg') {
      // Rough JPEG estimate: ~0.15–0.4 bits per pixel at quality 0.5–0.9
      const bpp = 0.08 + config.jpegQuality * 0.4;
      bytesPerFrame = (pixels * bpp) / 8;
    } else {
      // PNG: roughly 0.5–1.5 bytes per pixel after deflate
      bytesPerFrame = pixels * 0.3;
    }

    const totalBytes = bytesPerFrame * effectiveFrames;
    return totalBytes;
  }, [frames.length, getConfig, effectiveFrames]);

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleGenerate = useCallback(async () => {
    if (frames.length === 0) return;
    setStatus('processing');
    setProgress({ stage: 'part0', current: 0, total: 0 });

    try {
      const config = getConfig();
      const blob = await generateBootanimationZip(frames, config, (stage, current, total) => {
        setProgress({ stage, current, total });
      });
      setZipSize(blob.size);
      const name = file?.name?.replace(/\.gif$/i, '') ?? 'bootanimation';
      saveAs(blob, `${name}.zip`);
      setStatus('done');
    } catch (e) {
      setStatus('error');
      setError(`生成失败: ${(e as Error).message}`);
    }
  }, [frames, file, getConfig]);

  // Frame preview carousel
  const maxPreviewFrames = 12;
  const previewFrames = frames.filter((_, i) =>
    i % Math.max(1, Math.floor(frames.length / maxPreviewFrames)) === 0
  ).slice(0, maxPreviewFrames);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e2e8f0]">
      {/* Header */}
      <header className="border-b border-[#1e1e2e]">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-lg">
            🎬
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            GIF → <span className="text-violet-400">Bootanimation</span>
          </h1>
          <span className="ml-auto text-xs text-[#71717a]">Android 开机动画生成器</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Upload Area */}
        <motion.div
          layout
          className={`
            relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer
            transition-all duration-200
            ${dragOver ? 'drag-active' : 'border-[#27272a] hover:border-[#3f3f46]'}
            ${file ? 'p-6' : 'p-12'}
          `}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => !file && document.getElementById('file-input')?.click()}
        >
          <input
            id="file-input"
            type="file"
            accept="image/gif"
            className="hidden"
            onChange={onFileChange}
          />

          <AnimatePresence mode="wait">
            {!file ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-3"
              >
                <div className="w-16 h-16 rounded-2xl bg-[#1c1c2a] flex items-center justify-center text-3xl">
                  📁
                </div>
                <div>
                  <p className="text-lg font-medium">拖拽 GIF 文件到这里</p>
                  <p className="text-sm text-[#71717a] mt-1">或点击选择文件</p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="file"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center text-lg">
                    🖼️
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-sm">{file.name}</p>
                    <p className="text-xs text-[#71717a]">
                      {(file.size / 1024).toFixed(0)} KB · {frames.length} 帧 · {frames[0]?.width}×{frames[0]?.height}
                    </p>
                  </div>
                </div>
                <button
                  className="text-xs text-[#71717a] hover:text-red-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-500/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    setFrames([]);
                    setStatus('idle');
                    setError('');
                  }}
                >
                  移除
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 text-sm text-red-400 bg-red-500/10 rounded-lg px-4 py-2"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {file && frames.length > 0 && (
          <>
            {/* Config Grid */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6"
            >
              {/* Preview */}
              <div className="bg-[#111118] rounded-2xl border border-[#1e1e2e] p-5">
                <h3 className="text-sm font-medium text-[#a1a1aa] mb-3">预览</h3>
                <div className="aspect-video bg-[#0a0a0f] rounded-xl overflow-hidden flex items-center justify-center">
                  {previewUrl && (
                    <img
                      ref={previewRef}
                      src={previewUrl}
                      alt="GIF preview"
                      className="max-w-full max-h-full object-contain"
                    />
                  )}
                </div>
              </div>

              {/* Basic Config */}
              <div className="bg-[#111118] rounded-2xl border border-[#1e1e2e] p-5 space-y-5">
                <h3 className="text-sm font-medium text-[#a1a1aa]">参数配置</h3>

                {/* Resolution */}
                <div>
                  <label className="text-xs text-[#71717a] mb-2 block">分辨率</label>
                  <div className="flex flex-wrap gap-2">
                    {RES_PRESETS.map((p) => (
                      <button
                        key={p.value}
                        className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
                          resMode === p.value
                            ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                            : 'bg-[#1c1c2a] text-[#a1a1aa] border border-transparent hover:border-[#3f3f46]'
                        }`}
                        onClick={() => setResMode(p.value)}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  {resMode === 'custom' && (
                    <div className="flex gap-2 mt-2">
                      <input
                        type="number"
                        value={customW}
                        onChange={(e) => setCustomW(Number(e.target.value))}
                        className="w-24 bg-[#1c1c2a] border border-[#27272a] rounded-lg px-3 py-1.5 text-xs text-center focus:outline-none focus:border-violet-500/50"
                        placeholder="宽"
                      />
                      <span className="text-[#52525b] self-center">×</span>
                      <input
                        type="number"
                        value={customH}
                        onChange={(e) => setCustomH(Number(e.target.value))}
                        className="w-24 bg-[#1c1c2a] border border-[#27272a] rounded-lg px-3 py-1.5 text-xs text-center focus:outline-none focus:border-violet-500/50"
                        placeholder="高"
                      />
                    </div>
                  )}
                </div>

                {/* FPS */}
                <div>
                  <label className="text-xs text-[#71717a] mb-2 block">
                    帧率 <span className="text-violet-400 font-mono text-xs">{fps} FPS</span>
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={30}
                    value={fps}
                    onChange={(e) => setFps(Number(e.target.value))}
                    className="w-full accent-violet-500"
                  />
                  <div className="flex justify-between text-[10px] text-[#52525b]">
                    <span>1</span>
                    <span>30</span>
                  </div>
                </div>

                {/* Part mode */}
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs text-[#71717a]">单段动画</label>
                    <p className="text-[10px] text-[#52525b] mt-0.5">
                      {singlePart ? '全程循环播放' : '前半段循环 + 后半段播放一次'}
                    </p>
                  </div>
                  <button
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      singlePart ? 'bg-violet-500' : 'bg-[#27272a]'
                    }`}
                    onClick={() => setSinglePart(!singlePart)}
                  >
                    <motion.div
                      className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow"
                      animate={{ left: singlePart ? '1.25rem' : '0.125rem' }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Compression Config */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 bg-[#111118] rounded-2xl border border-[#1e1e2e] p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-[#a1a1aa]">压缩设置</h3>
                {estimatedSize && (
                  <span className="text-xs text-[#71717a]">
                    预估输出 ~{formatSize(estimatedSize)}
                    {frameSkip > 1 && (
                      <span className="text-[#52525b] ml-1">
                        ({frames.length} 帧 → {effectiveFrames} 帧)
                      </span>
                    )}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Format */}
                <div>
                  <label className="text-xs text-[#71717a] mb-2 block">输出格式</label>
                  <div className="flex gap-1">
                    {(['png', 'jpeg'] as ImageFormat[]).map((f) => (
                      <button
                        key={f}
                        className={`flex-1 px-3 py-1.5 text-xs rounded-lg transition-all ${
                          format === f
                            ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                            : 'bg-[#1c1c2a] text-[#a1a1aa] border border-transparent hover:border-[#3f3f46]'
                        }`}
                        onClick={() => setFormat(f)}
                      >
                        {f === 'png' ? 'PNG 无损' : 'JPEG 有损'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* JPEG Quality */}
                <div>
                  <label className="text-xs text-[#71717a] mb-2 block">
                    {format === 'jpeg' ? 'JPEG 质量' : '质量（仅 JPEG）'}
                    <span className="text-violet-400 font-mono text-xs ml-1">
                      {format === 'jpeg' ? Math.round(jpegQuality * 100) + '%' : '—'}
                    </span>
                  </label>
                  <input
                    type="range"
                    min={10}
                    max={95}
                    value={Math.round(jpegQuality * 100)}
                    onChange={(e) => setJpegQuality(Number(e.target.value) / 100)}
                    disabled={format !== 'jpeg'}
                    className={`w-full accent-violet-500 ${format !== 'jpeg' ? 'opacity-30' : ''}`}
                  />
                  <div className="flex justify-between text-[10px] text-[#52525b]">
                    <span>小文件</span>
                    <span>高质量</span>
                  </div>
                </div>

                {/* Frame Skip */}
                <div>
                  <label className="text-xs text-[#71717a] mb-2 block">
                    跳帧 <span className="text-violet-400 font-mono text-xs">
                      {frameSkip === 1 ? '不跳' : `1/${frameSkip}`}
                    </span>
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={Math.min(10, frames.length)}
                    value={frameSkip}
                    onChange={(e) => setFrameSkip(Number(e.target.value))}
                    className="w-full accent-violet-500"
                  />
                  <div className="flex justify-between text-[10px] text-[#52525b]">
                    <span>1</span>
                    <span>{Math.min(10, frames.length)}</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Frame Sequence Preview */}
            {previewFrames.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 bg-[#111118] rounded-2xl border border-[#1e1e2e] p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-[#a1a1aa]">帧序列</h3>
                  <span className="text-[10px] text-[#52525b]">
                    {previewFrames.length}/{frames.length} 帧
                  </span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {previewFrames.map((frame, i) => (
                    <div
                      key={i}
                      className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                        previewFrame === i ? 'border-violet-500 shadow-lg shadow-violet-500/20' : 'border-transparent hover:border-[#3f3f46]'
                      }`}
                      onClick={() => setPreviewFrame(i)}
                    >
                      <FrameThumbnail frame={frame} />
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Download Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 flex flex-col items-center gap-4 bg-[#111118] rounded-2xl border border-[#1e1e2e] p-6"
            >
              {/* Progress */}
              {status === 'processing' && (
                <div className="w-full max-w-md">
                  <div className="flex justify-between text-xs text-[#71717a] mb-2">
                    <span>{progress.stage === 'part0' ? '生成 part0...' : '生成 part1...'}</span>
                    <span>{progress.current}/{progress.total}</span>
                  </div>
                  <div className="w-full h-1.5 bg-[#1c1c2a] rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full"
                      animate={{
                        width: progress.total > 0
                          ? `${(progress.current / (effectiveFrames)) * 100}%`
                          : '0%',
                      }}
                      transition={{ duration: 0.2 }}
                    />
                  </div>
                </div>
              )}

              <button
                className={`
                  px-8 py-3 rounded-xl text-sm font-medium transition-all
                  ${status === 'processing'
                    ? 'bg-[#1c1c2a] text-[#52525b] cursor-not-allowed'
                    : status === 'done'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-400 hover:to-fuchsia-400 shadow-lg shadow-violet-500/25'
                  }
                `}
                onClick={handleGenerate}
                disabled={status === 'processing'}
              >
                {status === 'idle' && '🎬 生成 Bootanimation.zip'}
                {status === 'processing' && '⏳ 生成中...'}
                {status === 'done' && `✅ 下载完成 (${formatSize(zipSize)}) — 再次生成`}
              </button>

              {status === 'done' && (
                <p className="text-xs text-[#71717a]">
                  文件已保存。你可以调整参数后再次生成。
                </p>
              )}
            </motion.div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1e1e2e] mt-12 py-4 text-center text-[10px] text-[#52525b]">
        <p>所有处理均在浏览器本地完成，文件不会上传到服务器。</p>
      </footer>
    </div>
  );
}

/** Tiny component to render a single frame as a canvas thumbnail */
function FrameThumbnail({ frame }: { frame: GifFrame }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = frame.width;
    canvas.height = frame.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(frame.data, 0, 0);
  }, [frame]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full object-cover"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}

export default App;
