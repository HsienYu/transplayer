# Performance / 效能與掉影格分析

作品影片的解碼落在 CPU，所以**播放順不順主要取決於 CPU**。這份文件說明為什麼，
以及它代表的硬體需求。

## 根因 / Root cause（primary evidence）

- 作品影片 `stonesandelephants.webm`：VP9、2160×1920、25fps、**含 alpha 透明通道**
  （Matroska `alpha_mode=1`，以 `ffprobe` 確認）。
- 應用是 Electron 45.1.0，內嵌 Chromium 156。
- Chromium 的 `MojoGpuVideoAcceleratorFactories::IsDecoderConfigSupported` 對**帶
  alpha 的影片，除非 codec 為 HEVC，否則拒絕硬體解碼路徑**。VP9+alpha 因此被退回
  libvpx **軟體解碼**（`VpxVideoDecoder` 對 color 與 alpha 各用一個 libvpx context，
  成本加倍）。GPU 只負責畫面合成／rasterization，不負責解碼；沒有任何 GPU flag 能把
  VP9+alpha 的解碼移到 NVDEC。

官方依據：
- Electron v45.1.0 DEPS（Chromium 156 pin）
- Chromium 156 `media/mojo/clients/mojo_gpu_video_accelerator_factories.cc`
- Chromium 156 `media/filters/vpx_video_decoder.cc`
- NVIDIA Video Codec SDK NVDEC decoder guide

## 硬體需求 / Hardware guidance

因為解碼吃 CPU，播放機必須用**現代多核心 CPU**：

- 雙核心 **Celeron G3930**（無 HT）實測：軟解 2160×1920@25 的 VP9+alpha，加上瀏覽器
  search/scroll 編排，system CPU ~98%、GPU 解碼端 0%、renderer 執行緒長時間在 runqueue
  等待，完整作品掉格約 **38%**——這類低階 CPU **不可用**。
- 參考展場機（多核心 CPU＋RTX 4060）實測完整作品**掉影格 0**，播放順暢。

獨立顯卡負責畫面合成與透明，有獨立顯卡更穩；但瓶頸在 CPU 解碼，顯卡不能代勞。

## 不做的事 / Constraints

不會在未經藝術家視覺驗收下擅自轉檔或改變作品外觀。即使是為了把解碼移到硬體
（例如把 color／alpha 打包成不透明影片再以 shader 重建透明，或改用 HEVC+alpha），
都會動到作品或管線，須經藝術家視覺驗收與完整發行閘門才可採用。

Related: [operations](operations.md) · [user guide](user-guide.md)
