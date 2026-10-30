# Historical installation guide — Ubuntu 18.04 / X11

Archived guide for the previous machine, not the Ubuntu 25.10 replacement.
The release status and PM2 observations below are historical.
Read [the current README](../../README.md) and [new-host runbook](ubuntu25-r8.md).

A transparent, click-through video installation across two portrait displays.
Video timecodes drive live image-search windows, their placement and scrolling.

Transplayer 將透明影片覆蓋在桌面與瀏覽器上，以影片時間碼控制即時圖片搜尋、
視窗位置及向下捲動。展覽裝置版使用獨立 Linux 發行包，不以 `npm start`
作為現場安裝方式。

## Release status / 版本與實際狀態

目前整理中的版本是 **r7b：Google 圖片搜尋＋新版 Chrome／ChromeDriver**。
它保留原始 13 個搜尋事件、19 個時間點、視窗幾何與捲動節奏，以及原生 Dock
智慧隱藏。影片首次從 **775 秒**開始，780 秒結束後由零循環。

- Electron **9.3.2**／內建 Node **12.14.1**
- Chrome for Testing／ChromeDriver **156.0.8078.80**，版本完全一致
- Selenium **4.0.0-alpha.7**、OSC **2.1.0**
- NopeCHA **0.6.1**（Manifest V3）；不再載入舊 uBlock Origin 1.23.0（Manifest V2）
- 手動播放不需要另外安裝 Node、npm、Chrome、Driver 或 PM2；設定桌面捷徑需要 Python 3
- PM2 是可選的展場程序管理方式，使用的是同版 **AppDir/AppRun**，不是 AppImage 掛載程序

**CAPTCHA 尚未解決。** 實機已確認新版瀏覽器、Driver、視窗定位、合成頁捲動與
外掛啟用，但 Google 仍可能停在 `/sorry/index`／reCAPTCHA。最近的封裝版測試
連續 60 秒沒有載入圖片，也沒有可捲動範圍。外掛啟用不等於驗證成功；
程式不會自動暫停時間軸，重啟也不保證解除限制。

使用者已接受這個限制並同意部署 r7b。**目前尚未完成正式切換**：最近一次部署連線
檢查顯示展示機離線，無法重新確認遠端播放狀態。上次確認執行的是 r6；桌面捷徑與
已保存的 PM2 配置當時仍指向 r4。不可將本文件、建置成功或 PM2 的 online 狀態
當作完整展覽驗收。實際遷移紀錄見 [r7 runbook](google-r7.md)。

## Exhibition installation / 展覽裝置版安裝與設定

### 1. Target hardware and desktop / 硬體與桌面環境

已測試的固定展示環境：

- Linux x86_64、Ubuntu **18.04.5**、glibc **2.27**
- **X11**、GNOME Shell **3.28.4**、Ubuntu Dock **63**
- 兩台螢幕各 **1080×1920**，左右排列成 **2160×1920**，不是鏡像顯示
- 原始影片 `stonesandelephants.webm`：2160×1920、780 秒，約 3.12 GB
- 可讀取影片的專用展示帳號、可連 Google 圖片搜尋與外掛服務的網路
- GTK3、NSS、ALSA、GBM、XSS 等瀏覽器所需共享函式庫，以及啟用的非特權 user namespace
- 桌面工具 `python3`、`xdg-user-dir`、`gio`；PM2 wrapper 另需 `timeout`、`xset`、`gdbus`

這不是 macOS／Windows 安裝包，也未驗證新版 GNOME 或 Wayland。AppImage 不包含
核心、顯示驅動或所有系統函式庫。若缺依賴，先記錄錯誤並確認目標環境，
不要用 `--no-sandbox` 或直接替換系統 glibc 來繞過。

### 2. Prepare release files / 準備發行檔

從已驗證的交付備份取得下列檔案；此 repository **沒有公開下載的成品或影片**：

- `Transplayer-ubuntu18-x86_64-r7b.AppImage` 與其 `.sha256`
- 完整 `portable-r7b.AppDir/`：PM2 必須保留；手動模式也可用它作為 AppImage 的替代入口
- 原始影片，不要改名後忘記更新設定，也不要放進 git
- 對應來源快照，包含 `packaging/install-desktop.py`；使用 PM2 時還需要
  `ecosystem.config.js`、`packaging/pm2-launch.sh`

建議放在同一個展示帳號家目錄下：

```text
~/Documents/
  transplayer-source-r7b/           # 對應的來源快照與安裝工具
  transplayer-releases/
    Transplayer-ubuntu18-x86_64-r7b.AppImage
    Transplayer-ubuntu18-x86_64-r7b.AppImage.sha256
    portable-r7b.AppDir/            # 勿在 PM2 使用時移除
  transplayer-media/
    stonesandelephants.webm        # 或保留原本已驗證的影片路徑
```

影片可以留在原本安裝目錄，不必複製 3.12 GB；在安裝指令指定實際路徑即可。
來源、AppImage、AppDir 與工具鏈要對應同一版本，不要混用舊 Driver。

在目標 Ubuntu 的終端機驗證成品：

```sh
RELEASES="$HOME/Documents/transplayer-releases"
(cd "$RELEASES" && sha256sum -c Transplayer-ubuntu18-x86_64-r7b.AppImage.sha256) &&
  chmod u+x "$RELEASES/Transplayer-ubuntu18-x86_64-r7b.AppImage"
```

r7b 成品 SHA-256：
`c4a189d6a63546aa2f364ef9e10df1a3a995c1c935baff9217db55a91e1041fa`。
校驗不符就停止，不要啟動。日後重建的成品以當次對應的 sidecar／交付紀錄為準。

### 3. Configure the two displays / 雙螢幕設定

1. 登入專用展示帳號的 X11／GNOME 桌面；不要停在登入畫面。
2. 在系統「設定 → 顯示器」關閉鏡像，將兩台螢幕設為直向、左右相鄰。
   旋轉方向依實際安裝決定，兩台有效解析度都必須是 1080×1920。
3. 關閉不需要的其他顯示輸出，確認兩台縮放比例一致，合成桌面為 2160×1920。
4. 套用並保留設定，重新登入／重開機後再確認；一次 `xrandr` 指令不代表永久設定完成。

```sh
printf '%s\n' "$XDG_SESSION_TYPE"
xrandr --listmonitors
```

預期為 X11、兩個 1080×1920 螢幕。播放器會檢查螢幕數量與合成尺寸，
不符時會報錯停止，而不是偷偷縮放到其他版型。更改 JSON 的尺寸並不會重新編排
固定的瀏覽器時間軸，因此不要把改數值當成任意解析度支援。

### 4. Install configuration and shortcuts / 首次安裝設定與捷徑

以下僅用於**尚未安裝捷徑的新展示帳號**。先把三個路徑改成實際位置：

```sh
SOURCE="$HOME/Documents/transplayer-source-r7b"
RELEASES="$HOME/Documents/transplayer-releases"
VIDEO="$HOME/Documents/transplayer-media/stonesandelephants.webm"
python3 "$SOURCE/packaging/install-desktop.py" \
  --appimage "$RELEASES/Transplayer-ubuntu18-x86_64-r7b.AppImage" \
  --video "$VIDEO"
```

安裝工具以一般展示帳號執行，**不要 sudo**。它會建立：

- `~/.config/transplayer/config.json`，權限 0600
- `xdg-user-dir DESKTOP` 指定桌面上的 `Transplayer.desktop` 與 `Stop-Transplayer.desktop`
- 可執行的捷徑與 GNOME trusted metadata；若桌面仍詢問，手動選擇信任／允許啟動

工具**不會**安裝開機服務、自動登入或螢幕設定；若捷徑已存在或設定不同，會拒絕覆寫。
既有展示機請用下方「升級與回復」，不要先刪除捷徑強行重裝。

設定格式如下，`videoPath` 改為實際可讀檔案：

```json
{
  "videoPath": "/absolute/path/stonesandelephants.webm",
  "startSeconds": 775,
  "expectedWidth": 2160,
  "expectedHeight": 1920
}
```

`videoPath` 必須是本機檔案；相對路徑以 **config.json 所在目錄**解析，不是終端機 cwd。
`startSeconds` 必須早於影片長度；正式作品維持 775。額外或拼錯的欄位會被拒絕。
[config.example.json](../../config.example.json) 是相對路徑示例，不是可原樣套到每台機器的設定。

### 5. Dock, top bar and power / Dock、頂部列與電源

影片視窗透明、置頂且滑鼠可穿透。播放期間頂部列暫時隱藏；正常停止或主程序 IPC
斷線時還原。Ubuntu Dock 保留原生智慧隱藏，僅排除透明播放器 PID，其他視窗仍會
參與遮擋判定；沒有其他視窗遮住 Dock 時才露出。

在已測試的 Ubuntu Dock 63 上，先確認以下設定。**新機安裝**若不符合，
先記錄舊值，再由現場人員套用：

```sh
gsettings get org.gnome.shell.extensions.dash-to-dock dock-fixed
gsettings get org.gnome.shell.extensions.dash-to-dock autohide
gsettings get org.gnome.shell.extensions.dash-to-dock intellihide
gsettings get org.gnome.shell.extensions.dash-to-dock intellihide-mode
```

預期依序為 `false`、`true`、`true`、`'ALL_WINDOWS'`。需要設定時：

```sh
gsettings set org.gnome.shell.extensions.dash-to-dock dock-fixed false
gsettings set org.gnome.shell.extensions.dash-to-dock autohide true
gsettings set org.gnome.shell.extensions.dash-to-dock intellihide true
gsettings set org.gnome.shell.extensions.dash-to-dock intellihide-mode 'ALL_WINDOWS'
```

播放器本身不永久改這些偏好。原時間軸的底層搜尋瀏覽器可能覆蓋整個桌面，
所以**只關閉上層瀏覽器不一定讓 Dock 出現**。

在系統設定中另外檢查展示期間的自動鎖定、黑屏、省電休眠與通知行為，依場地政策
設定；安裝工具不會替你更改。長時間展出前要實測，不應只確認影片會啟動。

### 6. Daily start and stop / 現場啟停

手動模式：

```sh
APPIMAGE="$HOME/Documents/transplayer-releases/Transplayer-ubuntu18-x86_64-r7b.AppImage"
"$APPIMAGE"
# 正常停止，不會廣泛殺掉其他 Chrome
"$APPIMAGE" --stop
```

也可使用兩個桌面捷徑，或 **Ctrl+Alt+Q** 停止。若 AppImage 掛載不可用，
可改執行同版 `portable-r7b.AppDir/AppRun`，不要因此覆寫系統 Chrome。
同一展示帳號只允許一個播放器實例。

**使用 PM2 的裝置以 `pm2 restart transplayer` 恢復播放**，不要用 Start 捷徑啟動
另一個未受 PM2 管理的程序。Stop 捷徑／快捷鍵是正常停止，設定上不會因此自動重啟。
重啟一律從 775 秒開始，不會接續上次位置。

### 7. PM2 and boot / 展場程序管理與開機

手動 AppImage 不需要 PM2。若選用 PM2，先在展示帳號安裝並確認可用的 Node／PM2；
已測試主機使用 nvm Node **16.20.2** 管理 PM2，這與內建播放用 Node12 是兩件事。
不要為了播放去升級封裝內的 Electron。

在登入的展示帳號下設定，且先確認沒有手動播放器執行：

```sh
# 僅在使用該 nvm 版本的裝置需要這行；其他裝置使用自己的已驗證 PATH
export PATH="$HOME/.nvm/versions/node/v16.20.2/bin:$PATH"
export TRANSPLAYER_EXECUTABLE="$HOME/Documents/transplayer-releases/portable-r7b.AppDir/AppRun"
export TRANSPLAYER_CONFIG="$HOME/.config/transplayer/config.json"
export DISPLAY=:0
export XDG_RUNTIME_DIR="/run/user/$(id -u)"
export DBUS_SESSION_BUS_ADDRESS="unix:path=$XDG_RUNTIME_DIR/bus"
pm2 start "$HOME/Documents/transplayer-source-r7b/ecosystem.config.js" --only transplayer
pm2 status
pm2 logs transplayer --lines 50 --nostream
```

`DISPLAY` 與 Xauthority 要符合實際登入的 X11 session。ecosystem 優先採用已設定的
`XAUTHORITY`，否則選 `~/.Xauthority` 或 runtime 的 `gdm/Xauthority`；
若桌面驗證失敗，先查 session，不要改為 root 或停用存取控制。
wrapper 會等待可驗證的 X11 **以及 GNOME／Ubuntu Dock**，所以等待期間 PM2
可能顯示 online，但影片尚未播放。

核對唯一程序的 script／cwd／args、影片持續前進、兩螢幕與 localhost:8080 正常後：

```sh
pm2 save
pm2 startup
```

依 PM2 印出的指令由管理員設定開機服務，保持應用本身由一般展示帳號管理。
**`pm2 startup` 不會幫你登入 GNOME**。無人值守還需要現場管理員在 Ubuntu
使用者設定中啟用專用帳號自動登入、保存雙螢幕旋轉與排列，並實際重開機驗證。
這些設定及重開機播放目前都不能宣稱已驗證。

開機驗收需確認：正確帳號已登入 X11、兩螢幕 2160×1920、影片時間前進、
Google／CAPTCHA 狀態有記錄，以及停止後頂部列／Dock 恢復。只有 service enabled
或 PM2 online 不足以通過驗收。

### 8. Environment and privacy / 環境變數與隱私

- `TRANSPLAYER_CONFIG`：外部 JSON 路徑；預設 `~/.config/transplayer/config.json`
- `TRANSPLAYER_PROFILE_DIR`：專用瀏覽器 profile 根目錄；r7b 預設
  `~/.local/share/transplayer/profiles-r7`，不要使用私人或 Chrome87 的 profile
- `TRANSPLAYER_DISABLE_CAPTCHA_EXTENSION=1`：不載入 NopeCHA；PM2 模式須更新其環境後重啟
- `TRANSPLAYER_CHROME`／`TRANSPLAYER_DRIVER`：開發／探針指定二進位；AppRun 會設為包內同版路徑
- `TRANSPLAYER_EXECUTABLE`：載入 ecosystem 時指定 AppRun；不是一般 AppImage 執行參數

NopeCHA 可能將 CAPTCHA 內容送至第三方服務。目前只使用無帳號／無 API key 的免費功能，
沒有購買額度。使用專用展示帳號，不登入個人服務、不放個人憑證。不要公開 PM2
dump／完整環境、profile、cookie 或任意頁面內容。舊 Electron 與作業系統仍有安全風險；
升級外部 Chrome 不等於整套 runtime 已現代化。

## Upgrade and rollback / 既有裝置升級與回復

詳細步驟及預期數量見 [Google／r7b runbook](google-r7.md)。

1. 先取得這次變更的核准並檢查即時狀態。確認舊版與新版本路徑、成品雜湊、
   影片、螢幕與目前程序，不依賴先前記錄的 PID。
2. 在遠端私有目錄備份設定、兩個捷徑與 PM2 儲存檔（目錄 0700／檔案 0600）。
   備份檔可能包含環境資料，**不可貼出內容或加入 git**。
3. 把新成品放在新版本目錄，校驗 AppImage sidecar 與 AppDir manifest；
   保留原始安裝、影片與舊版成品，不直接覆寫。
4. 用 `pm2 stop transplayer` 正常停止；確認該 PID／所屬子程序已退出、
   localhost:8080 沒有監聽，頂部列與 Dock 已還原。
5. 這台展示環境的 PM2 曾在 restart 後保留舊 script／cwd。變更來源路徑時，
   只移除**已驗證停止的** `transplayer` 定義，再從新 ecosystem 啟動；
   不要只加 `--update-env` 就假定所有路徑已更新。
6. 確認唯一 online 程序、script／cwd／args 全部屬於新版本、影片時間與 frame 前進；
   再原子替換兩個桌面捷徑的 AppImage 目標、保留執行權限與 trusted metadata，
   最後 `pm2 save`。不要直接覆寫正在運作的 PM2 dump。
7. 搜尋被 CAPTCHA 阻擋要記錄，不能當成已解決。這次使用者已接受限制，不代表
   以後所有部署都自動核准。執行完整一輪與場地驗收後才交付。

回復時同樣先正常停止新版本、確認程序與 port 釋放，再重建已備份版本的 PM2
定義與捷徑；驗證實際播放後保存 PM2。不要廣泛 `pkill Chrome`、刪除 profile
或覆寫系統函式庫。r4（舊 Google／Chrome87）與 r6（DuckDuckGo／Chrome87）是
保留成品，不代表外部搜尋現在一定可用。無法驗證回復時留下安全停止狀態並回報。

## Project layout / 專案結構

- `main.js`：Electron 主程序、雙螢幕／影片視窗、獨立子程序與停止控制
- `app/`：透明影片 renderer、preload bridge、OSC 時間碼送出與 frame 記錄
- `sub-process.js`：僅綁定 localhost:8080 的 OSC WebSocket bridge
- `web-process-new.js`：目前唯一使用中的瀏覽器時間軸；保留舊檔名以免無故改 runtime
- `controller.js`：ChromeDriver／瀏覽器、專用 profile、捲動及 session 回收
- `portable.js`：外部設定、螢幕合成範圍與時間碼驗證
- `desktop-state.js`／`desktop-guard.js`：暫時頂部列／Dock hook 與退出復原
- `packaging/`：離線建置、工具鏈鎖定、AppRun、首次安裝捷徑與 PM2 wrapper
- `ecosystem.config.js`：單實例 PM2 設定；來源路徑與 AppDir 必須配套保存
- `tests/`：單元／回歸測試、Linux 探針與人工驗證程序
- `config.example.json`：外部影片設定示例

影片、profile、release 成品、`node_modules`、本機驗證輸出不屬於來源樹，均應放在
外部或 gitignored 路徑；`evidence/` 保留實際完整輸出但不進 git。不要為了整理
目錄而刪除未完成驗收的回復檔。舊版 Windows focus／舊 timeline／packager 輔助程式
先前已移除，現存入口、測試、鎖檔與打包工具都有用途，本次不做額外 runtime 重構。

## Development and offline build / 開發與離線建置

### Tests / 測試

在開發機使用 Node **18+** 與 Python **3**：

```sh
npm test
```

測試使用 Node 內建 test runner，瀏覽器封裝測試會呼叫 Python 標準函式庫，
不需另外安裝測試套件。生產 JavaScript 保持 Node12 相容。
各套件／真實 Linux 探針的執行條件見 [tests/README.md](../README.md)。
`npm start` 只是原始碼開發入口；repository 不附影片、Chrome、Driver、外掛或
已驗證的 legacy runtime，不能宣稱 `npm install && npm start` 就完成展場安裝。

### Offline package / 離線封裝

在已驗證的 Linux 環境使用原始安裝提供的固定 Electron／非 dev 相依套件。
Chrome／Driver／外掛則取自 [browser-toolchain.json](../../packaging/browser-toolchain.json)
所列官方 URL，並以**完全相同的檔名**放入 archive 目錄：
`chrome.zip`、`chromedriver.zip`、`nopecha-0.6.1-chromium.zip`。
AppImage 工具版本與校驗碼在 [toolchain.json](../../packaging/toolchain.json)。

```sh
python3 packaging/build-portable.py \
  --legacy /absolute/path/original-installation \
  --browser-archives /absolute/path/locked-browser-archives \
  --output /absolute/path/new-release.AppDir
python3 packaging/build-appimage.py \
  --tool /absolute/path/verified-appimagetool.AppImage \
  --appdir /absolute/path/new-release.AppDir \
  --output /absolute/path/Transplayer-new-release.AppImage
```

builder 會先核對全部 archive SHA-256，再解壓與執行版本檢查；要求 Chrome／Driver
與鎖檔完全一致、外掛 manifest 相符，拒絕 ZIP traversal／symlink、不保留 setuid/setgid，
並輸出 `VERSIONS.json`、`SHA256SUMS`。所有 output 必須不存在，不能覆寫舊版。
AppImage 使用已鎖定工具本身的 runtime，不會抓取浮動 latest runtime。

保存來源快照、lockfile、三個 archive、AppImage 工具、AppDir、AppImage sidecar、
影片與部署紀錄。未驗證乾淨環境線上 `npm ci` 可完整重建；也不要只更新二進位卻
忘記同版 Driver、雜湊與實機回歸測試。發行包供專用裝置使用，公開散布前需另查
Chrome／外掛等元件的授權。

## Verification and handoff / 驗證與交付界線

已執行：39 項單元／回歸測試、r7b 來源與成品雜湊、封裝 controller 的合成頁捲動、
新版 Chrome／Driver 開窗與定位、外掛清單啟用，以及先前的原生 Dock
shown／hidden／shown、正常停止與父程序斷線恢復。

仍需現場／部署後驗收：r7b 正式切換、完整 780 秒循環、實際圖片載入與捲動、
透明度／滑鼠穿透、雙螢幕實體接縫、音訊、重開機、自動登入與代表性的長時間 soak。
最近的 Google 外站測試是 CAPTCHA 阻擋，不是成功搜尋。已知風險、使用者接受
限制與尚未驗證的項目要一起交接。

- [通用實機驗證](portable.md)
- [歷史 Google／r7b 部署與回復](google-r7.md)
- [歷史 DuckDuckGo／r6 遷移程序](duckduckgo-r6.md)

若播放器與獨立 desktop guard 都被強制殺掉，GNOME 暫態還原可能無法執行；
優先使用正常停止，必要時由現場人員登出／登入重置桌面。不要把短 smoke test
稱為整套裝置已可無人值守展出。
