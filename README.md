# Transplayer — Elephants and Stones

A transparent, click-through video installation across two portrait displays.
Video timecodes drive live image-search windows, placement and scrolling.

透明、滑鼠可穿透的雙直向螢幕影像裝置。作品影片為 2160×1920、780 秒，
首次由 775 秒開始，之後從零循環；保留原始 13 個搜尋事件、19 個時間點及視窗／捲動編排。

## Platform and release status / 平台與版本

**新安裝目標：Ubuntu 26.04 LTS amd64、GNOME 50、Ubuntu Dock、Wayland／Xwayland。**
需要兩台各 1080×1920 直向螢幕、左右延伸、縮放 100%，以及另外取得的原作品影片。
ARM、其他桌面與其他 Ubuntu 版本未列為新安裝支援平台。

**正式安裝平台為 Ubuntu 26.04。** 目前套件版本 `1.1.0~rc8`，已在參考展場機（MSI MS-7D17／RTX 4060）
完成安裝、重開機與自動播放驗證（掉影格 0），具可安裝的 `.deb`。rc8 另修正：視窗 13 全螢幕背景
鋪滿整個桌面（補償 GTK 視窗陰影）、停用 NopeCHA 擴充功能的警示 bar；新機安裝需先關閉桌面 dock 佔位
（見手冊）。藝術家／美術館自助安裝流程見
[安裝與操作手冊](docs/user-guide.md)。
轉為長期展出前仍待補：長時間 soak 測試與發行前授權／漏洞／lintian 稽核（由技術人員處理）。
自助安裝不需 Git、Node 開發環境或手動編輯 JSON。

本文件只涵蓋 Ubuntu 26.04 正式安裝。若另有舊 Ubuntu 25.10 現場仍在運行，
Ubuntu 25.10 已停止支援，但請**勿**因此自行就地升級正在播放的現場。

## For users / 一般使用者

請先閱讀[安裝與操作手冊](docs/user-guide.md)：給新手的逐步流程，涵蓋準備影片與螢幕、
核對並安裝 `.deb`、影片檔案位置、首次設定、開始／停止、自啟、更新與移除。
自 [GitHub Release v1.1.0-rc8](https://github.com/HsienYu/transplayer/releases/tag/v1.1.0-rc8)
下載 `transplayer_1.1.0.rc8_amd64.deb`（GitHub 會把版本號的 `~` 顯示成 `.`，套件內版本仍是
`1.1.0~rc8`），或向專案索取同一檔案；安裝前先核對其 SHA-256
（`5a919d05a08bc6b31770f5d02067a2ed2a6e320eef0680a9b79632c18884a0a5`，Release 頁亦有列）。
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
