# Development / 開發與建置

## Scope and architecture / 範圍與架構

Ubuntu 26.04 r10 的 `1.1.0~rc8` 已發布於
[GitHub Release v1.1.0-rc8](https://github.com/HsienYu/transplayer/releases/tag/v1.1.0-rc8)
並在參考展場機實機驗證；但仍屬 **RC**——發行前授權／漏洞／lintian／長時間 soak
稽核尚未全部完成。日常使用從[使用者指南](user-guide.md)開始；本文件給開發／發行人員。

- `main.js`、`app/`：透明影片、時間回報及正常停止。
- `web-process-new.js`、`controller.js`、`chrome-session.js`：原始時間軸、
  Chrome-first／WebDriver 生命週期、專用 profile 與 loopback 驗證。
- `desktop-modern-guard.js`、`desktop-client.js`、`packaging/gnome49/`：
  持續 D-Bus 連線及受限桌面租約。目錄名沿用 gnome49；
  r10 builder 產生只允許 r10 的 GNOME 50／revision 3 系統擴充套件。
  不是開放任意 GNOME Eval，也不是把 metadata 改成 50 就視為相容。
- `packaging/installer/`：Python 標準函式庫設定／啟動／維護／建置邏輯；
  GTK3 延遲載入。顯示器探針在獨立子程序的主執行緒初始化 GDK，
  設定視窗不在背景執行緒操作 GTK。
- `packaging/installer/release.json`：r10 路徑、版本、桌面 revision 及 supervisor 版本契約。
  Debian 版本 `1.1.0~rc8` 不會自動改寫作品原本 `package.json` 的歷史應用版本。

GPU 候選版保留 Electron 預設加速，不再由 `main.js` 全域停用；
未強制影片硬解、忽略 GPU blocklist 或停用 GPU sandbox。
正式機獨立 A/B 掉格率 11.56%→1.62%，兩輪仍為 Vpx 軟體解碼。
操作者已確認該探針的透明、無黑底／閃爍與穿透；完整作品、音訊、
瀏覽器 UI、生命週期及 soak 仍須以新版安裝後驗證。
專用 Chrome profile 同時關閉翻譯／儲存密碼等提示與預設權限詢問；
不修改私人 profile、不略過憑證或 Safe Browsing。

## Tests / 開發與測試

開發機需要 Node **18+**、Python **3.10+**。安裝器本身只以 Ubuntu 26.04 系統 Python 為目標。
純測試不需要 npm install、GTK、root、真實 PM2 或 Ubuntu 桌面。

```sh
npm test
python3 tests/installer_cases.py
```

Node 使用內建 test runner；其中一項會執行整組 Python fixture 測試，
所以不能把兩者的數字直接相加稱為 Node 測試總數。
完整輸出及 red／green 紀錄放在 gitignored `evidence/`。
測試覆蓋與實機程序見[測試說明](../tests/README.md)及
[Ubuntu 26.04 驗收程序](../tests/manual/ubuntu26-installation.md)。
無額外 lint/typecheck script；交接前另做 Python 編譯、JSON／shell 語法、
文件連結、diff 及秘密掃描。

`npm start` 是原始碼開發入口，不是安裝替代方案。
影片不納入 Git，Linux runtime 也不會因 clone 就出現。
不要在 Mac 上執行 Linux 二進位或把模擬測試當成真正 GNOME／dpkg 驗收。

## Build inputs / 乾淨建置輸入

以一般帳號在新的建置目錄準備，不從現場機複製私人 profile、授權檔或影片。
固定輸入：

- Electron **45.1.0**／內建 Node **24.22.1**：
  [runtime-toolchain.json](../packaging/runtime-toolchain.json) 的官方 archive 與 SHA-256。
  該鎖檔的 baseline 仍是歷史 Ubuntu 25.10，不是 Ubuntu 26.04 驗收聲明。
- 應用依賴：根目錄 [package-lock.json](../package-lock.json)，
  Selenium **4.0.0-alpha.7**、OSC **2.1.0**；不得暗中 audit fix。
- Chrome for Testing／ChromeDriver **156.0.8078.80**：
  [browser-toolchain.json](../packaging/browser-toolchain.json)。
- 私有 supervisor：官方 Node **24.22.2** archive／SHA-256 位於
  [tools-toolchain.json](../packaging/installer/tools-toolchain.json)，
  PM2 **7.1.1** 與依賴位於 [supervisor lockfile](../packaging/supervisor/package-lock.json)。

先在乾淨應用輸入目錄複製根 package／lock，執行 `npm ci --ignore-scripts`，
另外校驗並安全解壓官方 Linux Electron archive 到 `node_modules/electron/dist`。
既有 portable builder 的 `--legacy` 名稱沿用舊介面，
實際必須是版本相符的乾淨依賴／runtime 目錄，不代表可以任取未驗證的舊安裝。
該 builder 檢查依賴版本但不替代官方 Electron archive 來源／雜湊校驗。

```sh
python3 packaging/build-portable.py \
  --legacy /absolute/path/verified-app-inputs \
  --browser-archives /absolute/path/locked-browser-archives \
  --output /absolute/path/build-input.AppDir
```

瀏覽器 archive 按既有介面命名為 `chrome.zip`、`chromedriver.zip`、
`nopecha-0.6.1-chromium.zip`；三者都由既有 builder 校驗。
NopeCHA 由 builder 解壓為未封裝的 `app/nopecha/`，chrome-first 於啟動時以
`--load-extension` 載入（rc4 起，藝術家 2026-11-06 授權重新納入；授權責任在藝術家）。
最終 staging 只移除打包用的 `nopecha-0.6.1.zip`（僅舊 webdriver 路徑使用），保留未封裝目錄。
operator 可用 `TRANSPLAYER_DISABLE_CAPTCHA_EXTENSION=1` 即時停用 solver（免重裝）。
CfT 156 實測：`--load-extension` 在 `--disable-infobars` 下不會出現開發人員模式警示 bubble。

在另一個乾淨 supervisor 輸入目錄複製 `packaging/supervisor/package*.json` 後：

```sh
npm --prefix /absolute/path/clean-supervisor ci --ignore-scripts --no-fund
python3 packaging/prepare-supervisor.py \
  --node-archive /absolute/path/node-v24.22.2-linux-x64.tar.xz \
  --npm-root /absolute/path/clean-supervisor \
  --output /absolute/path/new-tools
```

這只組裝輸入，不執行 Linux Node／PM2。
工具檢查 Node archive 的釘選雜湊、supervisor lockfile bytes、安裝版本及路徑型別；
**不會重新依 npm registry integrity 校驗 node_modules 每個已解壓檔案**。
可信來源依賴乾淨 `npm ci` 的 integrity 檢查與建置環境保全；
自行對不可信目錄產生 SHA256SUMS 不會讓它成為可信輸入。
PM2、其相依原始碼／授權檔、Node LICENSE 會隨工具組保留。
Linux 的 `npm ci` 會省略例如僅限 macOS 的 optional `fsevents`。
工具準備以固定 Linux/x64 輸出目標解讀鎖檔的 `os`／`cpu`：
只允許缺少明確排除此目標的 optional 套件；必要或適用套件缺項、
已有套件版本不符與 symlink 仍會拒絕，不改鎖檔或跳過全部 optional。

## Stage and package / 組裝套件

`build-deb.py` 要求已核對並獨立記錄的兩份 manifest SHA-256，
拒絕 extra／missing／tampered／symlink／特殊檔及 setuid 輸入。
輸出目錄不可存在。`--maintainer` 必須由專案明確提供核准的發行聯絡資訊，
不會把 AI 代理地址冒充專案維護者。

```sh
python3 packaging/build-deb.py \
  --bundle /absolute/path/build-input.AppDir \
  --tools /absolute/path/new-tools \
  --bundle-manifest-sha256 "$BUNDLE_MANIFEST_SHA256" \
  --tools-manifest-sha256 "$TOOLS_MANIFEST_SHA256" \
  --maintainer "$APPROVED_PACKAGE_MAINTAINER" \
  --stage /absolute/path/new-deb-stage
```

環境變數為發行人員事先取得的 provenance 值，不是秘密或應用程式 runtime 設定。
此命令只產生 **staging tree，不是可安裝套件**。
在 Ubuntu 26.04 amd64 建置機上，使用全新的 stage 路徑，
同一命令加上 `--build /absolute/path/transplayer_1.1.0~rc8_amd64.deb`，
才會呼叫 `dpkg-deb --root-owner-group --build` 並輸出 SHA-256 sidecar。
本階段尚未執行真正 Linux 建置。

產生物含 r10 AppDir、固定私有 supervisor、CLI／GTK 選單入口、
精確 AppArmor userns profiles、GNOME 50 revision 3 與自包含的 dpkg hooks。
不含影片、使用者設定或私人 profile。建置收據與版本放在套件內，
`hardwareVerified: false` 不因 staging 成功而變成 true。

## Release gates / 發行前閘門

1. 實際 Linux 建置，確認 dependency package 名稱／完整性、執行檔及動態函式庫、
   dpkg contents／root 權限、lintian、Desktop Entry、AppArmor 編譯與安裝生命週期。
2. 完成第三方授權與散布審查：應用 Artistic-2.0、Electron／Chromium notices、
   Chrome for Testing 散布條件、ChromeDriver、Node、PM2 AGPL-3.0 與所有相依。
   自動產生 notices **不等於法律／授權審查已通過**。
3. 評估保留依賴的已知弱點；既有 Selenium／OSC 相依鏈有警告，
   歷史 GitHub push 曾回報 20 項（12 high／6 moderate／2 low），
   這不是此次完整或最新弱點掃描，不宣稱已修復。
4. 執行完整[實機驗收](../tests/manual/ubuntu26-installation.md)，含重登／重開、
   長時間監測、升級／移除／失敗回復。舊 r9 現場測試不可代用。
5. 另取得使用者同意後才 commit、push、tag 或建立實際 Release。
   發布套件、SHA-256、版本／provenance 與授權資料後，才在 README 放真實下載入口。

官方參考：[GDK3 init_check](https://docs.gtk.org/gdk3/func.init_check.html)、
[PyGObject threading](https://pygobject.gnome.org/guide/threading.html)、
[GNOME 50 porting](https://gjs.guide/extensions/upgrading/gnome-shell-50.html)、
[Debian maintainer scripts](https://www.debian.org/doc/debian-policy/ch-maintainerscripts.html)。
