# Transplayer — Elephants and Stones

A transparent, click-through video installation across two portrait displays.
Video timecodes drive live image-search windows, placement and scrolling.

透明、滑鼠可穿透的雙直向螢幕影像裝置。作品影片為 2160×1920、780 秒，
首次由 775 秒開始，之後從零循環；保留原始 13 個搜尋事件、19 個時間點及視窗／捲動編排。

## Platform and release status / 平台與版本

**新安裝目標：Ubuntu 26.04 LTS amd64、GNOME 50、Ubuntu Dock、Wayland／Xwayland。**
需要兩台各 1080×1920 直向螢幕、左右延伸、縮放 100%，以及另外取得的原作品影片。
ARM、其他桌面與其他 Ubuntu 版本未列為新安裝支援平台。

**正式安裝平台為 Ubuntu 26.04。** 目前套件版本 `1.1.0~rc21`，已在參考展場機（MSI MS-7D17／RTX 4060）
完成安裝、重開機與自動播放驗證（掉影格 0），具可安裝的 `.deb`。rc9–rc21 的重點：以乾淨快照快取
因應 Google reCAPTCHA（被擋時顯示已驗證的乾淨快照、沒被擋時顯示即時搜尋並擇優更新快取）、修正嵌入式
CAPTCHA 造成的灰畫面、可調的影片下方淡灰降彩度圖層（設定 `videoTint`）、以及「背景視窗自動放大後仍保持
即時」的顯示判斷修正。rc20 進一步修正快照更新：即時頁面只要乾淨載入且達門檻（預設 40 張縮圖、非灰／
非被擋）就以最新畫面刷新該搜尋的快照（取代先前需滿 100 張且完全載入的過嚴條件，否則大型延遲載入的
圖片牆永遠存不進去、被擋時只能回放過期快照）；灰／不完整頁面仍絕不會被存。rc21 將同一放寬套用到每小時
預錄（seed）：乾淨、非灰、縮圖載入達門檻（40 張）且完全載入即預存，不再要求捲動深度——先前載入數百張仍被
深度門檻擋掉的乾淨頁（例如 explosion news 載入 351 張卻被擋）現在也能預存刷新。視窗 13 全螢幕背景鋪滿整個
桌面（補償 GTK 視窗陰影）、停用 NopeCHA 擴充功能的警示
bar；新機安裝需先關閉桌面 dock 佔位（見手冊）。藝術家／美術館自助安裝流程見
[安裝與操作手冊](docs/user-guide.md)。
轉為長期展出前仍待補：長時間 soak 測試與發行前授權／漏洞／lintian 稽核（由技術人員處理）。
自助安裝不需 Git、Node 開發環境或手動編輯 JSON。

本文件只涵蓋 Ubuntu 26.04 正式安裝。若另有舊 Ubuntu 25.10 現場仍在運行，
Ubuntu 25.10 已停止支援，但請**勿**因此自行就地升級正在播放的現場。

## For users / 一般使用者

請先閱讀[安裝與操作手冊](docs/user-guide.md)：給新手的逐步流程，涵蓋準備影片與螢幕、
核對並安裝 `.deb`、影片檔案位置、首次設定、開始／停止、自啟、更新與移除。
自 [GitHub Release v1.1.0-rc21](https://github.com/HsienYu/transplayer/releases/tag/v1.1.0-rc21)
下載 `transplayer_1.1.0.rc21_amd64.deb`（GitHub 會把版本號的 `~` 顯示成 `.`，套件內版本仍是
`1.1.0~rc21`），或向專案索取同一檔案；安裝前先核對其 SHA-256
（`df4630851918b37ec055ac33553c773041dfd3ac0358c86aee15efa8602b9b98`，Release 頁亦有列）。
不要把 clone 原始碼或 staging tree 當成安裝包。

設定工具不自動登出／重開、修改 GDM／螢幕配置或索取密碼。
展示瀏覽器使用未加密專用儲存，請勿登入私人帳號或儲存密碼。
即時搜尋依賴網路與第三方網站，不能保證不出現 CAPTCHA。

## Documentation / 文件導覽

- [一般使用者指南](docs/user-guide.md)：安裝、設定、日常起停、更新／移除與常見問題。
- [開發與建置](docs/development.md)：架構、固定依賴、測試、乾淨輸入、套件及發行閘門。
- [技術維運](docs/operations.md)：權限、AppArmor、桌面租約、隔離 PM2、診斷、遷移與回復。
- [測試說明](tests/README.md)及[Ubuntu 26.04 實機驗收程序](tests/manual/ubuntu26-installation.md)。

## Development quick check / 開發快速檢查

測試需要 Node 18+、Python 3.10+，不需真正桌面或全域安裝：

```sh
npm test
```

詳見[開發指南](docs/development.md)。自動化測試不證明透明度、聲音、實體幾何、
網站穩定性或展覽可用性；所有真正部署仍須有記錄的實機驗收。

## Snapshot refresh / 快照更新

Validated snapshot playback is the default (deployed since rc19), with an independent
live-search option. Two paths keep the cache fresh:

- **Live display refresh**: whenever the wall itself browses a clean, ungated page
  (`gated === false`, at least 40 thumbnails loaded), that view replaces the query's
  snapshot unconditionally — the newest clean capture always wins.
- **Hourly seed**: on playback start, then one hour after each pass completes, a background
  pass re-fetches all 13 queries using the logged-in account profile. The seed additionally
  requires every visible thumbnail finished (`pending === 0`), and keeps the existing
  snapshot when a new capture is thinner than 70% of it and under 24h old — a guard so a
  transient thin grab never replaces a rich one.

rc20 relaxed the live path and rc21 the seed to this count-based gate; the earlier bar
(100-plus loaded plus full scroll-depth coverage) left lazy-loaded grids of hundreds of
images stale forever, so a blocked page could only fall back to an expired snapshot. Grey or
incomplete pages are still never stored. See [operations](docs/operations.md) for first-cache
preparation, the capture gate and troubleshooting, and
[visual acceptance](tests/manual/scheduled-snapshots.md).

The settings window also provides an optional NopeCHA switch, masked API-key entry, key
removal and an official account-management link. It affects background captures starting
with the next pass and live-search windows after playback restarts. Snapshot-only playback
has its own independent switch. See operations for private storage and manual validation.
