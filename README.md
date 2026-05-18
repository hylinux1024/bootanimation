# GIF → Bootanimation

将 GIF 动图转换为 Android 开机动画（bootanimation.zip）。纯浏览器端处理，文件不会上传到服务器。

## 功能

- 拖拽上传 GIF 文件
- 实时预览原动画
- 分辨率（保持/1080p/720p/480p/自定义）
- 帧率调节（1–30 FPS）
- 单段/双段动画模式
- PNG 无损 / JPEG 有损输出
- JPEG 质量调节 + 跳帧压缩
- 预估输出大小
- 一键下载 bootanimation.zip

## 本地运行

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build    # 输出到 dist/
npm run preview  # 预览构建产物
```

## 部署

Push 到 `main` 分支自动通过 GitHub Actions 部署到 GitHub Pages。

也可将 `dist/` 目录部署到任意静态托管服务（Vercel、Netlify、Cloudflare Pages 等）。

## License

MIT
