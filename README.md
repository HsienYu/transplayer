# Transplayer — Elephants and Stones

A transparent, click-through video installation across two portrait displays.
Video timecodes drive live image-search windows, placement and scrolling.

透明、滑鼠可穿透的雙直向螢幕影像裝置。作品影片為 2160×1920、780 秒，
首次由 775 秒開始，之後從零循環；保留原始 13 個搜尋事件、19 個時間點及視窗／捲動編排。

## Platform and release status / 平台與版本

**新安裝目標：Ubuntu 26.04 LTS amd64、GNOME 50、Ubuntu Dock、Wayland／Xwayland。**
需要兩台各 1080×1920 直向螢幕、左右延伸、縮放 100%，以及另外取得的原作品影片。
ARM、其他桌面與其他 Ubuntu 版本未列為新安裝支援平台。

**r10 自助安裝版目前為 RC 原始碼：尚未發布可下載 `.deb`，尚未完成 Ubuntu 26.04 實機驗收。**
已提供設定介面、套件建置入口及測試；不等於已有可安裝成品。
新機到位後仍需完成 Linux 建置、相依與授權檢查、安裝／重開／移除及實際播放驗收。
本階段不建立替代 VM，也不更動正在運行的展覽機。

既有 Ubuntu 25.10／GNOME 49 現場維持 **r9 stage3 RC**。
使用者於 2026-10-31（UTC）確認超過八小時運行、查看時正常，以及重開後自動播放正常；
這不是 r10／Ubuntu 26.04 驗收，也不是全程零錯誤的監測證據。
Ubuntu 25.10 已停止支援，請勿因此自行升級正在播放的現場。

**Ubuntu 18.04 展場正式機使用 r7b portable。**
Electron 9.3.2 + Chrome-for-Testing 156、NopeCHA 0.6.1，PM2 自動啟動。
因 glibc 2.27 限制無法使用較新 Electron，透明度必須以軟體合成實現（GPU + 透明無法並存）。
已部署於 hsu-ms-7d17（i5-11500 / RTX 3050 / nvidia-525），2026-11-04 驗收通過（自動開機播放）。
詳見 [Ubuntu 18.04 portable 部署指南](docs/ubuntu18-portable.md)。

## For users / 一般使用者

請先閱讀[使用者安裝與操作指南](docs/user-guide.md)：
準備影片與螢幕、候選版安裝流程、首次設定、開始／停止、自啟與移除。
正式套件發布後，使用者不需安裝 Git、Node 開發環境或手動編輯 JSON。
目前沒有下載入口；不要把 clone 原始碼或 staging tree 當成安裝包。

設定工具不自動登出／重開、修改 GDM／螢幕配置或索取密碼。
展示瀏覽器使用未加密專用儲存，請勿登入私人帳號或儲存密碼。
即時搜尋依賴網路與第三方網站，不能保證不出現 CAPTCHA。

## Documentation / 文件導覽

- [一般使用者指南](docs/user-guide.md)：安裝、設定、日常起停、更新／移除與常見問題。
- [開發與建置](docs/development.md)：架構、固定依賴、測試、乾淨輸入、套件及發行閘門。
- [技術維運](docs/operations.md)：權限、AppArmor、桌面租約、隔離 PM2、診斷、遷移與回復。
- [測試說明](tests/README.md)及[Ubuntu 26.04 實機驗收程序](tests/manual/ubuntu26-installation.md)。
- [Ubuntu 25.10 r9 現場 runbook](tests/manual/ubuntu25-r8.md)：只適用既有現場。
- [分流前完整 README／r9 歷史](docs/history/ubuntu25-r9-readme.md)：保留既有成功、失敗與限制。
- [Ubuntu 18.04 portable (r7b) 部署指南](docs/ubuntu18-portable.md)：正式機安裝、操作與復原。
- [歷史 Ubuntu 18.04 指南](tests/manual/ubuntu18-installation.md)：舊版參考。

## Development quick check / 開發快速檢查

測試需要 Node 18+、Python 3.10+，不需真正桌面或全域安裝：

```sh
npm test
```

詳見[開發指南](docs/development.md)。自動化測試不證明透明度、聲音、實體幾何、
網站穩定性或展覽可用性；所有真正部署仍須有記錄的實機驗收。
