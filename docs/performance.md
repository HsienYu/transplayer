# Performance / 效能與掉影格分析

## 現況結論 (recorded 2026-11-04)

正式機 hcw 播放原作品影片時會掉影格：完整作品實測約 **38%**，隔離單片測試
約 48%，開啟 GPU 合成後隔離測試降到約 **1.6%**，但完整作品仍約 38%。

**這不是 GPU 加速設定錯誤，而是影片 codec 的硬體解碼限制，無法以參數開關解決。**

## 根因 (primary evidence)

- 作品影片 `stonesandelephants.webm`：VP9、2160×1920、25fps、**含 alpha 透明通道**
  （Matroska `alpha_mode=1`，已以 `ffprobe` 於正式機確認）。
- 應用是 Electron 45.1.0，內嵌 Chromium 156.0.8078.49。
- Chromium 的 `MojoGpuVideoAcceleratorFactories::IsDecoderConfigSupported` 對**帶
  alpha 的影片，除非 codec 為 HEVC，否則拒絕硬體解碼路徑**。VP9+alpha 因此被退回
  libvpx **軟體解碼**（`VpxVideoDecoder` 對 color 與 alpha 各用一個 libvpx context，
  成本加倍）。
- 正式機 CPU 是 **Celeron G3930（雙核、無 HT）**。軟解 2160×1920@25 的 VP9+alpha，
  加上瀏覽器 search/scroll 編排，實測 system CPU ~98%、GPU 解碼端 0%、one-core 的
  renderer 執行緒長時間在 runqueue 等待。這是掉影格主因。
- 已部署的 **rc2** 移除了 `app.disableHardwareAcceleration()`，讓 GPU 負責
  **合成 / rasterization**（隔離測試掉格 48% → 1.6%），但**解碼仍在 CPU**，完整
  作品仍掉約 38%。沒有任何 GPU flag 能把 VP9+alpha 的解碼移到 NVDEC。

官方依據（prior session 查證）：
- Electron v45.1.0 DEPS（Chromium 156 pin）
- Chromium 156 `media/mojo/clients/mojo_gpu_video_accelerator_factories.cc`
- Chromium 156 `media/filters/vpx_video_decoder.cc`
- NVIDIA Video Codec SDK NVDEC decoder guide

## 可行選項（都需使用者決定，會動到作品或硬體，不應在無人驗收時盲做）

1. **Opaque-repack + GPU shader 重建 alpha**：把 color 與 alpha 打包成一支**不透明**
   影片（硬解可行的格式，或無 alpha 的 VP9），在 app 內以 WebGL/CSS shader 重新合成
   透明度。可保留原視覺，但需 app 新增 shader 管線 + 轉檔 + 使用者視覺驗收。
   **前提**：需先在這台機器證實其 Linux/Electron/Chromium 能硬解**普通（無 alpha）**
   的 VP9/H.264——目前尚未證實（GPU A/B 測的影片都帶 alpha，仍走軟解）。
2. **改用 HEVC + alpha**：Chromium 僅對 HEVC 允許帶 alpha 的硬解路徑。但 Linux/Electron
   的 HEVC + NVDEC alpha 支援不確定、WebM 不能封裝 HEVC（需 MP4/fMP4），可行性低、風險高。
3. **降低瀏覽器編排的 CPU 成本**：實測 WebDriver 的逐像素捲動也吃掉約一顆核心。若改用
   compositor transform 取代逐像素捲動，可釋放 CPU 給解碼——但會改到視覺編排，需使用者確認。
4. **換更強的播放機**：雙核 Celeron 是硬限制。較強 CPU（或能真正硬解的管線）可直接解決。

## 不做的事

- 不會在未經使用者視覺驗收下擅自轉檔或改變作品外觀。
- rc2（GPU 合成版）已是目前最佳且已部署的狀態；本輪未再更動播放器效能設定。

Related: [operations](operations.md) · [user guide](user-guide.md) · [PLAN](../PLAN.md)
