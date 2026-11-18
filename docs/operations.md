# Operations / 技術維運指南

## Scope / 適用範圍

本文件適用 Ubuntu **26.04 LTS amd64／GNOME 50**；目前部署版本為 `1.1.0~rc21`，
已在參考展場機實機驗證，發行前稽核閘門（soak／授權／漏洞／lintian）仍開放。
安裝來源與發行限制見[開發指南](development.md)；
一般設定見[使用者指南](user-guide.md)。
**不要對正在運行的舊 Ubuntu 25.10／r9 現場套用以下命令；本文件只適用 Ubuntu 26.04。**

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

## Display confirmation / 方向與左右確認

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

## 瀏覽器與 CAPTCHA 處理 / Browser and CAPTCHA handling

chrome-first 每次建立瀏覽器皆加入 `--hide-crash-restore-bubble`、`--disable-infobars`
與 `--disable-blink-features=AutomationControlled`（最後者只降低自動化特徵，不會消除
Google 的 /sorry/ 流量濫用判定），不使用 `--restore-last-session`、不偽造正常退出，
也不刪除專用 profile、session 檔或 SingletonLock。啟動前在已驗證且未鎖定的專用 profile
安全合併 Preferences，關閉翻譯／密碼等提示並拒絕預設權限要求，不修改退出狀態、私人 profile
或憑證／Safe Browsing。

**NopeCHA 擴充功能預設不載入**：`runtime.py` 的播放器環境帶入
`TRANSPLAYER_DISABLE_CAPTCHA_EXTENSION=1`，chrome-first 不加 `--load-extension`
（NopeCHA 解不了本作品遇到的 Enterprise reCAPTCHA，改由快照快取處理，且載入會在畫面上多出
NopeCHA bar 與 Chrome 的「開發者模式擴充功能」警示 bar）；要重新啟用需改 `runtime.py`。

**全螢幕背景視窗（視窗 13）**：視窗 13 是鋪滿整個桌面的背景，一建立就設為全螢幕
（task 65 與 task 775 皆用它），其餘搜尋視窗 14–19 疊在上面。由於一般 Chrome 視窗外框尺寸
含 GTK CSD 隱形陰影，程式已自動外擴補償，讓可見內容貼齊 2160×1920 四邊，**不需**也**不要**
手動雙擊最大化（會把其他搜尋視窗壓到背後）。桌面 dock 另需兩項 dconf 設定（不在 .deb 內，新機
安裝後各執行一次，留存於 dconf、重開機後仍有效）：

```sh
gsettings set org.gnome.shell.extensions.dash-to-dock dock-fixed false
gsettings set org.gnome.shell.extensions.dash-to-dock intellihide false
```

`dock-fixed false` 讓 dock 不佔畫面空間、`_NET_WORKAREA` 為完整 `0,0,2160,1920`，視窗才能貼到
最左邊。`intellihide false` 把 dock 改為純自動隱藏並保持隱藏，避免它在桌面露出或焦點切換時彈出
（`require-pressure-to-show` 預設 true，只有刻意頂邊才會出現）。**不要**改用「停用 Ubuntu Dock
擴充功能」來隱藏——`desktop-modern-guard` 的桌面租約會 import 並操作 `dock._intellihide`，dock
不在會丟 `Unsupported Ubuntu Dock API`；而關閉 intellihide 設定不影響此物件（dock 無條件建立它）。

### Scheduled snapshots (deployed, rc19+)

Packaged playback reads the independent snapshot-only setting (default on). Manual
`snapshot-seed` always applies validated capture checks.
Snapshot-only displays use `snapshots-validated/`
under the profile root; legacy `snapshots/` remain untouched and are not imported.
Before trial playback, run the new `transplayer snapshot-seed` and verify all 13 queries
succeed. Missing snapshots display a blank page and log `snapshot unavailable`.

Two paths write snapshots. (1) The **hourly seed** (seeder.js/seed.js) starts a sequential
refresh on playback start, then waits one hour after completion before the next pass; each
query is attempted once and failures retain the previous cache. It writes through
`writeSnapshotIfRicher`, keeping the existing file when the new capture is under
`SNAPSHOT_KEEP_RATIO` (0.7) of its thumbnail count and under `SNAPSHOT_KEEP_MAX_AGE_MS` (24h)
old. (2) The **live display refresh** (controller.js) stores the wall's own view whenever it
browses a clean, ungated page for a query, replacing the snapshot unconditionally — newest
clean capture wins (`writeSnapshot`'s artifact-cleanliness check still applies). The timeline
owns and stops the updater. There is no separate boot seed in this version. Updates become
visible on the next navigation, never midway through a scroll.

The capture gate is count-based (rc20/rc21). The live display path (`displayCaptureOk`,
controller.js) requires only no detected CAPTCHA (`gated === false`) and at least 40 loaded
thumbnails (`DISPLAY_CAPTURE_MIN`). The hourly seed (`captureQuality`, seeder.js) adds
`pending === 0` (every visible thumbnail finished) on top of the same 40 floor
(`SEED_CAPTURE_MIN`). The earlier bar — 100-plus loaded plus document/image coverage reaching
the requested scroll distance plus the actual viewport height — froze lazy-loaded grids
(hundreds of images that never reach that depth), so their snapshots stayed stale and blocked
pages fell back to an expired cache. Decoded MHTML HTML parts and embedded frame markers are
still checked before writing; malformed artifacts fail closed.
An enabled solver gets at most 90 seconds to clear a detected gate. Failure preserves the
previous snapshot. Accepted files replace previous files atomically; the richness guard applies.
New account-login profiles are claimed only when empty. Existing unclaimed profiles are
refused; do not add a marker to an arbitrary browser profile to bypass this protection.
The dedicated profiles (including `seed-account`) must stay mode `0700` and keep their
`.transplayer-profile` marker (`0600`, exact bytes `transplayer-exhibition-basic-v1`). If
the top directory widens (e.g. `0775`) or the marker is lost, every capture fails closed
with `Unsafe Chrome profile directory` / marker errors and a pass returns `captured=0/13`.
The seed must run inside the native player session: launching `seed.js` over SSH, outside
the logged-in desktop session, was observed to abort (SIGABRT) at the first navigation. To
force a refresh remotely, restart the player (`pm2 restart`) so the in-process refresh worker
runs it; the local `transplayer snapshot-seed` command, run from the desktop session, is
unaffected.

A shared `snapshot-seed.lock` directory excludes overlapping manual/scheduled writes.
Normal exit and termination release it. Forced termination/power loss can leave a stale
lock: confirm no seed process remains before an operator clears it. Updater output goes
to the existing player supervisor logs.

These metrics do not establish grey-free pixels, offline MHTML completeness or GPU health.
Prior grey rendering while serving a snapshot remains unresolved. Run the
[offline and desktop acceptance protocol](../tests/manual/scheduled-snapshots.md)
before deployment. Preserve the old package/cache for rollback.

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

## NopeCHA settings (deployed; off by default)

Transplayer 設定新增「啟用 NopeCHA」、「API Key」、「儲存 NopeCHA 設定」、
「清除 NopeCHA API Key 並停用」，以及官方帳號管理連結。預設停用。
留空儲存保留既有金鑰；清除會同時停用。已存金鑰不回填畫面。
帳號密碼只在 NopeCHA 官方網站輸入，Transplayer 不收集帳號密碼。

開關存於 `~/.config/transplayer/nopecha.json`；金鑰獨立存於
`~/.config/secrets/transplayer-nopecha.key`（檔案 600、目錄 700）。
這是本機權限保護，並非加密。金鑰不加入一般設定備份、命令列或網址。
背景 seed 每輪重新讀設定；啟用時建立私人擴充功能副本，正常結束即清理。
強制終止可能留下 profile 根目錄中的 `nopecha-private-*`，仍限制為本人存取。
停止並確認沒有 seed 程序後，維運人員才能清理這些殘留副本。

設定下輪更新生效；正在執行的那輪繼續使用原設定。只讀快照模式的展示瀏覽器仍停用擴充功能；即時模式可依開關使用 NopeCHA，
所有快照品質門檻不變。無金鑰時可能使用服務允許的免費額度；付費金鑰可能消耗額度。
設定成功不代表帳號有效，也不保證解開展場的 reCAPTCHA。

改用同版本 0.6.1 官方 automation build，雜湊固定於 browser-toolchain.json。
[官方設定方式](https://developers.nopecha.com/guides/extension_advanced/)：
私人副本的 manifest.nopecha.key，不使用含金鑰的 Magic URL。
實際下載檔的 SHA-256 已核對，並以合成金鑰測試設定與清理；尚未使用真實金鑰或額度。

## Independent playback switches

「只讀完整儲存成功的快照」與 NopeCHA 各自儲存，不互相改動。
快照播放開關存於 `~/.config/transplayer/playback.json`，預設開啟。

| 只讀完整快照 | NopeCHA | 行為 |
|---|---|---|
| 開啟 | 關閉 | 展示讀合格快照；背景預抓不用 NopeCHA |
| 開啟 | 開啟 | 展示讀合格快照；背景預抓使用 NopeCHA |
| 關閉 | 關閉 | 即時搜尋，不用 NopeCHA；失敗改讀合格快照 |
| 關閉 | 開啟 | 即時搜尋與背景預抓使用 NopeCHA；失敗改讀合格快照 |

兩種模式都逐項背景更新，完成一輪後等一小時。即時模式也會嘗試擷取通過完整品質
檢查的頁面，兩者共用 `snapshots-validated/`。載入失敗、偵測到被擋或圖片未載入時
改讀備援，沒有合格備援就留白。即時頁面在偵測完成前可能短暫顯示挑戰；只有快照
模式不主動導航到即時搜尋。即時視窗每秒持續檢查，並於停止播放時清理監看計時器。

播放模式與即時視窗的 NopeCHA 開關須停止並重新開始播放；背景更新下輪讀取
NopeCHA 設定。切到即時模式不會停用背景預抓或降低快照品質門檻。


### Authorized initial legacy trial cache

For the initial rc15 trial, the user accepts shorter archived pages. Offline validation
accepts13/13 trial copies with no detected challenge and zero pending result thumbnails.
Eight short pages naturally stop at the document bottom while scene timing stays unchanged.
Query2's image-free challenge overlay was removed in an isolated derivative;100 loaded result
images remain, but the page is only one viewport tall and stays stationary. Original files
remain untouched. This exception is for the explicitly reviewed legacy imports only.
(This rc15 trial note predates rc20/rc21; the capture gate above is now count-only and no
longer requires full per-scene depth, but challenge artifacts are still rejected.)
See the deployment runbook for private evidence and pending installation/desktop acceptance.
