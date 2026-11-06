# Operations / 技術維運指南

## Scope / 適用範圍

本文件適用 Ubuntu **26.04 LTS amd64／GNOME 50 r10 RC**，尚未實機驗收。
安裝來源與發行限制見[開發指南](development.md)；
一般設定見[使用者指南](user-guide.md)。
**不要對正在運行的 Ubuntu 25.10 r9 現場套用以下命令。**
舊現場仍依[既有 runbook](../tests/manual/ubuntu25-r8.md)維護。

## Paths and ownership / 路徑與權限

- root 套件：`/opt/transplayer/releases/r10.AppDir`、`/usr/lib/transplayer`、
  `/usr/bin/transplayer`、`/usr/share/applications/transplayer-*.desktop`。
- 私有工具：`/usr/lib/transplayer/tools/node/bin/node`（24.22.2）及
  `tools/pm2/bin/pm2`（7.1.1）；不使用全域 npm／PM2。
- 系統擴充套件：`/usr/share/gnome-shell/extensions/transplayer-desktop@transplayer.local`，
  GNOME 50／revision 3，只 allowlist 精確 r10 executable／app／guard。
- AppArmor：`/etc/apparmor.d/transplayer-r10-electron`、
  `/etc/apparmor.d/transplayer-r10-chrome`；只給精確執行檔 userns，
  不關閉全域 AppArmor，不加入 `--no-sandbox`。
- 全系統啟動／維護閘門：`/var/lib/transplayer/start.lock` 與 `maintenance`。
  root／不可由一般使用者寫入。移除後刻意保留安全閘門，成功重新 configure 才解除。
- 本帳號設定：`~/.config/transplayer/` 為 0700，`config.json`／`setup.json` 為 0600；
  後者以 config SHA-256 標示本工具的成套設定，不是防範同 UID 使用者的數位簽章。
- 本帳號登入入口：`~/.config/autostart/transplayer-r10.desktop`，只能修改精確自有內容。
- 隔離 PM2 state／log／dump：`~/.local/state/transplayer-r10/` 為 0700。
- 專用瀏覽器：`~/.local/share/transplayer/profiles-r10-basic/`，
  由既有 Chrome session 邏輯管理展示標記與私有 profile。
  使用 `--password-store=basic`，**不加密密碼，禁止私人登入／儲存密碼**。

套件 root hooks 不掃描／修改使用者 HOME、不啟動播放器、不讀媒體或圖形憑證，
只檢查固定系統檔案與 `/proc/*/exe`；無法判斷仍存活程序時拒絕維護，
不因 permission denied 就略過。

## CLI / 一般展示帳號指令

下列命令在**該帳號目前的 GNOME 桌面**執行，除套件管理命令外不可 sudo：

```sh
transplayer setup
transplayer configure --video "/absolute/path/作品影片.webm" --autostart
transplayer enable-extension
transplayer doctor
transplayer start
transplayer status
transplayer stop
```

變更已知 r10 影片須明確加 `--replace`，備份存於設定目錄的
`config.backup-*.json`。取消 autostart 可透過 GUI 儲存未勾選狀態，
或在停止後執行 `transplayer detach`。`detach` 不結束 PM2 daemon；
要維護套件使用 `prepare-maintenance`。

`login` 是自啟專用；桌面狀態會最多檢查 30 次，每次失敗間隔 2 秒，
每個 subprocess 各有逾時。手動 start 立即回報未就緒。
狀態必須是本安裝器的精確 launcher／目前 DISPLAY、XAUTHORITY；
foreign／errored／舊登入授權狀態不會被自動刪除或接管。
需要修復時先查證該隔離 PM2 的程序身分及狀態，不要直接改 parser 放行。

開始／停止一律透過這個 CLI 或 GUI supervisor；
不要 `pm2 save/resurrect/update`、root `pm2 startup`、復用其他專案 PM2_HOME，
也不要只呼叫舊 `AppRun --stop`，避免自動重啟或帶入舊圖形授權。
`play` 是 supervisor 內部入口，不是日常直接播放介面。
套件的 `session-launch.py` 在父程序釋放帳號互斥鎖後才繼續，
並將全系統共用閘門跨 exec 保留到播放器結束；這仍需 Linux 實測 FD／PM2 行為。

## Display confirmation and browser recovery / 方向確認與瀏覽器回復

設定視窗可開啟 `gnome-control-center display`，由操作人員自行套用及保留設定；
套件明確相依 `gnome-control-center`。每台可獨立旋轉 90°／270°，
以旋轉後的邏輯矩形檢查左右相鄰的兩台 1080×1920、頂端對齊及 100% 縮放。
程式不要求兩台同方向、不寫 monitors.xml、不呼叫 Mutter 套用配置，也不旋轉媒體。
中央接縫對位不是本次驗收要求。

停止播放且桌面整合就緒後，可由設定視窗開啟方向／左右測試圖，
或在目前桌面執行 `transplayer screens`。
獨立 GTK3 子程序使用 Xwayland；按邏輯 x 座標分配 LEFT／RIGHT，而非 DP／HDMI 或列舉順序。
它持有套件共用鎖及帳號互斥鎖，檢查桌面租約／8080 閒置，不啟動 PM2 或另一個播放器。
測試中不允許透過正常入口同時啟動；若偵測到控制器或顯示器變動會退出。
Esc／關閉任一視窗會一起清理，120 秒後自動關閉。
全螢幕請求須經實際視窗狀態、尺寸與螢幕歸屬核對；三秒後仍不符即退出，
不能把 GTK 的請求回傳當成視窗正確定位。真正 GNOME50／Xwayland 行為仍待實測。
測試結束只回報已關閉，不把人工方向／左右確認寫成自動驗收成功。

chrome-first 每次建立瀏覽器皆加入 `--hide-crash-restore-bubble`、`--disable-infobars`
與 `--disable-blink-features=AutomationControlled`（後者自 r8/r7b 移植，只降低自動化特徵，
不會消除 Google 的 /sorry/ 流量濫用判定），
不使用 `--restore-last-session`、不偽造正常退出，
也不刪除專用 profile、session 檔或 SingletonLock。
rc4 起另以 `--load-extension=<app/nopecha>` 載入 NopeCHA solver（藝術家 2026-11-06 授權），
可用 `TRANSPLAYER_DISABLE_CAPTCHA_EXTENSION=1` 即時停用。另外 `controller.goTo` 在導向後若
落在 `/sorry/` 會記錄 `CAPTCHA sorry-retry` 並等待 `SORRY_RETRY_MS`（4 秒）重載一次；
/sorry/ 為單次軟性判定，換頁即自行消失，故重載即可恢復。
GPU／dialogs 候選版會在專用 profile 已驗證且未鎖定時，於啟動前安全合併
Preferences，關閉翻譯／密碼等提示並拒絕預設權限要求；不修改退出狀態、
私人 profile 或憑證／Safe Browsing 設定。實際瀏覽器 UI 仍須另驗。
Chrome156 的官方 [HasPendingUncleanExit](https://github.com/chromium/chromium/blob/156.0.8078.80/chrome/browser/ui/startup/startup_browser_creator.cc#L1598)
確認此旗標的判斷路徑；單元測試只證明啟動參數及重建路徑，不證明瀏覽器 UI。
發行時須以本版原始碼重建 portable 輸入，不能把舊 bundle 改名當成修正版。
新機須以專用 profile 的受控異常退出與下次登入驗證無復原提示、圖片載入及持續捲動，
不可只用網頁 DOM 或關閉提示後的畫面充當證據。

## Diagnostics / 診斷與隱私

```sh
transplayer doctor --report ./transplayer-report.json
```

報告以新建 0600 檔案輸出，不覆寫現存檔或 symlink。
只有 release／RC 狀態及平台、桌面 PASS／NOT_READY，
不含 HOME、影片路徑、原始例外、cookie、Xauthority bytes 或 PM2 環境。
`doctor` **不檢查影片解碼、實際聲音／透明度、完整時間軸、套件完整性或 soak**，
全 PASS 也不是正式驗收。
PM2 原始日誌／dump 可能含個人路徑或環境資訊；僅在私有位置檢查，
對外分享前獨立遮罩，禁止貼出完整 `pm2 jlist` 或憑證內容。
錯誤碼 78 代表設定／平台／桌面尚未就緒，PM2 不對此無限重啟。

## Maintenance and recovery / 維護與回復

在每個使用過 r10 的帳號，以目前登入環境執行：

```sh
transplayer stop
transplayer prepare-maintenance
```

第一步要確認桌面恢復、作品子程序與 8080／debugger 釋放。
第二步拒絕 online 播放器，結束該帳號隔離 PM2 並停用精確自有 autostart；
設定、影片、profile、日誌與備份保留。
若其他帳號還有套件 Node／Chrome／Electron，root 維護檢查會拒絕。
重新執行 `status` 可能再次啟動 PM2 daemon；準備維護後不要再執行它。

管理員先保留已驗證的舊 `.deb`、SHA-256 與私有設定備份，
再確認新套件版本、來源、目標機器及維護時段；不做 unattended upgrade。
套件操作前的鎖及程序檢查拒絕時立即停止，不使用強制 dpkg、廣泛 pkill、
profile／lock 刪除或擅自登出。

`preinst` 在解包前校驗 Ubuntu 26.04／amd64、拒絕手動 r8／r9、
取得獨占鎖並留下維護標記；不依賴新套件 helper。
`prerm` 維持閘門，remove 時卸載兩個精確 AppArmor profile。
`postinst configure` 重入檢查並載入兩個 profile，只在全部成功後清除閘門。
configure 失敗與 abort 路徑維持禁止啟動。`postrm` 為最小 shell no-op，
不假設 Python 在移除依賴後還存在，也不清 HOME。
移除先查 kernel 已載入的精確 profile 名稱，避免重試時再次卸載已移除的 profile；
讀取 securityfs 失敗仍拒絕，不假定安全。相依、實際 unload 重試及完整 dpkg 路徑尚待實機測試。

configure 失敗時保留完整私有日誌，由管理員修正**實際錯誤**後，
確認所有帳號均閒置，再使用標準套件管理重試：

```sh
sudo dpkg --configure transplayer
```

不要手動刪 `maintenance` 來放行。如果需回退，先維持停播及維護準備狀態，
檢查舊包的 hash／版本與相容性，再透過套件管理安裝保留的已知版本、
重新 configure，核對 AppArmor／版本／桌面登入後才人工試播。
**目前沒有經實機驗證的 r10 回退包或自動回退腳本**，
dpkg 不是整個作品的原子切換；完成回退演練之前不能作正式展覽交付。

設定寫入使用單檔 atomic rename，已知寫入失敗會嘗試回復已寫入部分。
多個檔案不是共同的 crash-safe transaction：斷電可留下 config／marker 不符，
此時安全拒絕啟動，不自動接管。先完整備份設定目錄，
再由技術人員以相符的私有備份成套恢復；不可只改 SHA 讓未知設定通過。

移除以標準 `sudo apt remove transplayer`；即使 `purge` 也不清使用者 HOME。
重新安裝完成 configure 後，逐帳號檢查保留狀態再自行啟用 autostart。

## Legacy migration / 舊版遷移

首版只針對乾淨新機。舊 r8／r9、舊自啟項、
同 UUID 的使用者層 extension 或未知 JSON 都**不自動採用**。
先由管理員閱讀該現場自己的 runbook，取得停播同意、
驗證活動閘門並保全原套件、extension、設定與捷徑；
遷移／回復需另有已核准程序，不能靠刪除衝突檔來「乾淨安裝」。
Ubuntu 25.10 已 EOL，這不是允許自動升級正在播放的現場之理由。
歷史限制及完整舊 README 保留於[歷史快照](history/ubuntu25-r9-readme.md)。
