# Transplayer — Elephants and Stones

A transparent, click-through video installation across two portrait displays.
Video timecodes drive live Google image-search windows, placement and scrolling.

以透明、滑鼠可穿透的影片覆蓋桌面，依時間碼控制圖片搜尋。影片 2160×1920、
780 秒，首次由 775 秒開始，之後從零循環；保留原始 13 個搜尋事件、
19 個時間點及既有視窗／捲動編排。

## Current platform and status / 目前平台與狀態

**主要安裝環境已改為 Ubuntu 25.10，不再以 Ubuntu 18.04 為主。**

- Ubuntu **25.10**（Questing Quokka）、Linux **x86_64**
- GNOME Shell **49.0**／**Wayland**，提供 Xwayland 執行舊 X11 程式
- Ubuntu Dock **102**
- 作品要求兩台各 **1080×1920**，左右合成 **2160×1920**、縮放 100%
- RustDesk **1.5.0** 已由使用者實測連線成功，TeamViewer 已移除

**現行版本為 r9 stage3，由 PM2 管理；受控瀏覽器回復已通過，代表性長時間 soak 尚未完成。**

stage3 原子部署後，新舊 root 版本各 726 檔獨立校驗通過；舊 stage2
保留於 `/opt/transplayer/releases/r9-stage2.AppDir`。完整 Linux 測試
97 pass／0 fail／0 skipped。實機只終止一次身分已核對的 `se_13` Chrome，
確實留下舊鎖；新版未手動刪鎖便在後續搜尋事件重建。118.2 秒時已見圖片
與捲動，129.1 秒確認持續捲動、原先接受的尺寸與舊除錯埠釋放。
播放器 PID、PM2 重啟數均不變，使用者確認全畫面搜尋與影片疊加正常。
**這是事件驅動回復，不是立即恢復**；原始 Chrome 退出原因仍未知，
長時間 soak 與 stage3 下次實際登入未驗證。使用者已明確決定先整合至
`master`、保全證據後移除工作樹並推送；這不代表長時間穩定性驗收通過。
完整證據見 `evidence/r9-stage3-real-browser-recovery.log`（runner exit 0）。

以下為 stage2 驗收、故障與暫時修復的歷史紀錄，不代表目前仍未部署：
r9 固定安裝於 `/opt/transplayer/releases/r9.AppDir`，revision2 GNOME
extension 已於登入後載入。Chrome-first 搜尋在原始 13 個事件均載入圖片
並捲動，首次完整時間軸 151 筆取樣未見 CAPTCHA；這不保證往後不會遇到
挑戰。第一次長測因只見一次回零而失敗，已保留失敗紀錄；第二次低干擾
觀察在牆鐘 871.14 秒看到第二次回零，播放器退出 0、桌面還原，總幀數
19676、掉幀 2055（10.44%）。使用者現場觀看並接受流暢度，但掉幀仍
須列為量測限制。預設搜尋視窗要求 (0,0)／2160×1920，實測
(18,0)／2158×1920；使用者暫時接受觀感，不等同精確幾何通過。
PM2 管理的 120 秒短測中，使用者確認聲音、滑鼠穿透與雙螢幕接縫，
正常 `pm2 stop transplayer` 後自有程序／8080 歸零，桌面與 Dock 還原。
受控主程序異常中斷的租約釋放、PM2 單一重啟與最後正常停止已實測；
使用者重新登入後回報自啟、沒有鑰匙圈提示；唯讀檢查確認單一無時限
PM2 r9 播放器、當次授權、租約及 8080，但原檢查在「沒有 PM2 dump」
斷言失敗，整份紀錄不能稱通過。PM2 7.1.1 登出時會自動寫入前次
程序的 dump；目前隔離目錄的上層為 0700、沒有還原服務，登入腳本
不使用 `resurrect`。**不可手動還原舊 dump**，其中的舊短測設定與
圖形授權不適用本次登入。
當時全畫面搜尋視窗 `se_13` 在播放途中消失：紀錄有 55 次
profile 鎖檔拒啟，該專用 profile 的鎖指向已死亡的本機 Chrome PID。
當時隔離分支已有回歸修正，但尚未部署；使用者同意的一次
可逆現場修復在偵測到其他 r9 Chrome 活動後依閘門停止，沒有移動鎖檔。
使用者另行同意短暫停播後，PM2 正常停止、零自有程序及桌面恢復均通過；
將唯一已死亡的 `se_13` 鎖移至私有備份，再以當次圖形授權啟動**原版**
r9。重新觀察確認單一全畫面 Chrome、自有 localhost 除錯端口、224 張圖
其中 221 張載入並捲動 1788px；使用者現場看得到預期畫面。第一次觀察
因誤判 Chromium 改寫的命令列而失敗，失敗紀錄亦保留。這僅是暫時回復，
不是永久修正或連續 soak 通過。r8 保留為回復成品，
其 Google 圖片搜尋仍受 CAPTCHA 阻擋。

已確認現有 webm 與原影片雜湊相符，兩台輸出
DP-1／HDMI-1 已左旋為各1080×1920，左右原點0／1080；原生使用者
`monitors.xml`已寫入，使用者重開機後已實測自動登入及雙直向保留。
r8 AppDir 與原始捷徑私有備份完整保留；r9 播放器目前由 PM2 持續運行，
切勿因檢查或版本切換而擅自停止。
使用者私有目錄已有固定 Node 24.22.2、PM2 7.1.1 及隔離 PM2 state：
目前有一個線上 `transplayer`；登出時的舊 stopped 定義留在 PM2 dump，
不等於本次線上程序。
使用者層 `~/.config/autostart/Transplayer-PM2.desktop` 已安裝，
人工觸發及真正登入均已觀察，但瀏覽器可靠性與連續 soak 未通過。
Node／PM2 均非全域安裝。

以下為歷史 r8 runtime 診斷（新機現行執行環境為 r9）：
已通過：無既有播放器／8080 監聽、私有設定備份、影片校驗、官方 Electron
9.3.2 archive SHA-256。第一次 GUI 探針缺少 `libXss.so.1`、退出127；
使用者核准後已只新增 `libxss1`，無升級或移除其他套件。
第二次GUI探針失敗：`No usable sandbox!`、退出 -5。
核心日誌確認 AppArmor 的 user-namespace 限制拒絕 Electron 所需權限。
使用者核准後已新增root擁有的相容性runtime與精確執行路徑AppArmor userns
profile；全域sysctl／沙箱未停用。Electron9雖建立視窗，GPU子程序仍連續
崩潰六次；失敗版本與證據保留。使用者另行核准測試並升級至官方穩定版
**Electron45.1.0／內建Node24.22.1**，已通過相同開窗及正常退出探針。
這還不是作品透明度／穿透或完整播放驗收。

GNOME49拒絕舊 `Eval`；新受限桌面extension已載入為ACTIVE，實機已拒絕
非播放器要求且桌面未受影響。首輪正式短測試在租約驗證停止：Electron45會
將主程序命令列改寫成單一完整title，舊檢查誤拒絕。已以TDD補上精確格式
及惡意近似值測試。使用者第二次登入後，修正版已通過正向租約及正常還原。
Wayland不能熱重載此JavaScript；GNOME49回報ReloadExtension已棄用。
r8已安裝於`/opt/transplayer/releases/r8.AppDir`，725項manifest、root權限與
兩個精確AppArmor profile通過檢查。config／兩個trusted捷徑已建立。
首輪短測試退出1的證據保留；第二輪退出0，實際影片775→0及後續時間前進
通過。固定805秒的首次長觀察未見第二次回零，完整循環斷言失敗；
保留失敗後改以實際事件為完成條件，最長1000秒安全退出，第二輪在
817.86秒觀察到第二次回零，**影片循環及正常桌面還原通過**。
不代表音訊、實體透明穿透、Dock shown/hidden/shown或soak驗收。
新機Google仍被CAPTCHA阻擋，NopeCHA已啟用但未解開。舊r7b仍只確認存在於離線舊機。
詳見 [新機runbook](tests/manual/ubuntu25-r8.md)。

## Exhibition installation / 展覽裝置版安裝與設定

### 1. Machine and dependencies / 主機與依賴

專用一般展示帳號先登入 GNOME 桌面，確認網路、RustDesk 與原始影片。
不以 root 播放，不使用私人 Chrome profile。於展示機桌面終端檢查：

```sh
cat /etc/os-release
gnome-shell --version
printf '%s\n' "$XDG_SESSION_TYPE"
systemctl is-active rustdesk
```

SSH 的 session 類型不一定等於實際桌面，必要時用 `loginctl` 確認。
本機已補上 `libxss1`；全新安裝時經管理員確認後補上此共享函式庫：

```sh
sudo apt-get install libxss1
```

這不是完整安裝或相容性保證；補上後仍須重新通過 runtime／sandbox／GUI 閘門。
其餘套件依當次錯誤與模擬結果處理，不整機升級或 `apt autoremove`。
不使用 `--no-sandbox`、全域停用 AppArmor 或替換系統 glibc 來繞過失敗。

### 2. Displays / 雙直向螢幕

先備份 `~/.config/monitors.xml` 與 Mutter 顯示配置。於「設定 → 顯示器」：

1. 使用延伸桌面，不鏡像。
2. 兩台設為 1080×1920 直向；本次規劃左旋，需核對現場實體方向。
3. 左右原點為 (0,0)／(1080,0)，縮放均為 100%。
4. 先暫時套用，確認本機及 RustDesk 正常，再保留設定。

Wayland 下 **不可用 Xwayland 的 `xrandr` 設定實體輸出旋轉**。
播放器要求兩個螢幕與合成 2160×1920，不符會停止；改 JSON 尺寸不會重新編排
固定瀏覽器時間軸。重新登入／開機後需再驗證，一次套用不代表永久配置已通過。

### 3. Runtime and desktop / 執行環境與桌面整合

使用已核准的 Electron **45.1.0**／內建 Node **24.22.1**，
Selenium **4.0.0-alpha.7**、OSC **2.1.0**。Electron9在新機GPU閘門失敗，
不再是新機目標。官方archive與SHA-256見
[runtime-toolchain.json](packaging/runtime-toolchain.json)。先實測Xwayland視窗、
透明度、滑鼠穿透、跨螢幕幾何與退出。舊 Ubuntu18 的成功不代表新機相容。

GNOME49需要新的使用者層 Shell extension，以受限操作暫時隱藏頂部列，
並讓原生 Dock 智慧隱藏忽略透明播放器。檔案安裝位置為
`~/.local/share/gnome-shell/extensions/transplayer-desktop@transplayer.local/`；
介面只允許Acquire／Release／Status，核對DBus呼叫程序與播放器親子關係、
UID及root擁有的固定執行路徑；主程序另接受實測的Electron45精確完整title，
不做模糊路徑／任意參數匹配。**已通過正向租約、正常還原與受控主程序
異常中斷時的租約釋放／PM2 重啟；extension 停用恢復仍待實機驗證**。
不能直接啟用舊 `desktop-guard.js` 或開啟任意 `Eval` 取代。
若載入需重新登入，先協調現場人員與 RustDesk，不自動登出／重開機。
正常停止、父程序斷線及 extension 停用都需驗證桌面還原。

省電、鎖定、通知與自動登入依場地政策設定；installer 不處理。
不要永久關閉 Dock／頂部列來代替作品的暫態桌面行為。

### 4. Release and video config / 發行檔與影片設定

現行發行檔是 root 擁有的 `/opt/transplayer/releases/r9.AppDir`，
stage3 封存 SHA-256 為
`e716084439dd922cc180f37046a295ffd2e98a14c282d49ba62fb94cd110e187`；
726 項 manifest、root 權限與精確 Electron／Chrome AppArmor profile
均已檢驗。r8 仍在固定路徑作回復，不可用任意掛載路徑的 AppImage
繞過沙箱。以下是歷史 r8 安裝封存 SHA-256：
`906710c32d6c437a2b6f73e93f93644fda8f1f70b84516225a8cfdd10f23dd24`。
歷史 r8 root 成品仍是不可變 stage1；其內附 extension 不是現行
revision2。當時另外安裝的 lease.mjs 修正版 SHA-256：
`9f4f180415083a0b030b70f4f6f9d3250cbefe24599216307d2f14da88d6fbc9`
是當時的中間版本，不可覆蓋目前 revision2 檔案。
不要沿用舊 r7b 雜湊校驗新成品。影片、profile、成品不加入 git。

外部設定為 `~/.config/transplayer/config.json`、權限 0600，參考
[config.example.json](config.example.json)：

```json
{
  "videoPath": "/absolute/path/stonesandelephants.webm",
  "startSeconds": 775,
  "expectedWidth": 2160,
  "expectedHeight": 1920
}
```

使用展示帳號現有 webm 的實際路徑，不移動／轉檔大型 mov 或覆寫原片。
相對 `videoPath` 以 JSON 所在目錄解析。原始影片 SHA-256：
`432aa9a2602c47f6ad86adc7eec26f3e912e81f196b1a19f6245a917dc9544d7`。

以下命令僅供**全新安裝手動直啟捷徑**時使用；既有展示機已完成
私有備份、活動閘門與 PM2 捷徑可逆切換，不能再執行 installer
覆蓋現行捷徑：

```sh
python3 /absolute/path/source/packaging/install-desktop.py \
  --executable /opt/transplayer/releases/r9.AppDir/AppRun \
  --video /absolute/path/stonesandelephants.webm
```

以一般展示帳號執行，不要 sudo。建立 config、Start／Stop 桌面捷徑與 trusted
metadata；拒絕覆寫既有捷徑或不同設定。展示機目前兩個 PM2
捷徑已核對 trusted metadata，並通過實際 `gio launch` 有界起停。
它不設定顯示器、開機服務或自動登入。

### 5. Operation and recovery / 操作與回復

新機直接執行 root 擁有的 r9 AppDir 時，正常停止使用 `AppRun --stop`
或 Ctrl+Alt+Q；這些獨立停止介面仍須各自實機驗證。
封裝完成後，手動播放不需另裝 Node、npm、Chrome、Driver 或 PM2。
監管設定使用固定 r9 `ecosystem.config.js`、
`packaging/pm2-launch.sh` 與 `packaging/pm2-session.sh`；GNOME 49
透過受限 Status／revision2 檢查，不使用舊 Eval。已用私有
Node 24.22.2／PM2 7.1.1 實機短測並安全停止。
版本化的使用者層 supervisor 位於
`~/.local/share/transplayer/supervisor/r9-20261030-login-safe/`。
兩個桌面捷徑已切換為 `pm2-session.sh start|stop`，並實際有界起停；
XDG autostart 已安裝，人工觸發與使用者真正重新登入均有觀察；
原驗收檢查因錯誤的「無 PM2 dump」假設而失敗，須保留失敗紀錄。
stage3 修正已上線並通過一次實機瀏覽器回復；代表性 soak 完成前，
不要宣稱持續播放通過，也不要為了驗證而重啟正在播放的程序。
日常停止須用 `pm2-session.sh stop` 或現行 Stop 桌面捷徑，
**不可只呼叫 `AppRun --stop`**，以免 PM2 重啟。若停止失敗，
先停止 PM2 自動重啟，再只對核對身分的自有 PID 發出 TERM；
KILL 為最後手段。完整條件與回復程序見
[新機 runbook](tests/manual/ubuntu25-r8.md)。
**不要** `pm2 save/resurrect` 或 root `pm2 startup`：登入時應以
XDG autostart 從當次桌面授權建立單一程序，且仍須由使用者協調下次
登入回報沒有鑰匙圈提示，唯讀檢查確認無
`TRANSPLAYER_SMOKE_SECONDS`、單一播放器與 8080 監聽；然而
後續瀏覽器故障與原驗收失敗仍阻止「可靠自動播放」結論。

遇錯保留日誌、正常停止本次自有程序，確認8080／子程序釋放及桌面還原。
不要廣泛 `pkill Chrome`、刪 profile／影片或停 RustDesk。由當次私有備份回復
設定；完整順序與預期結果見新機 runbook。

## Google and CAPTCHA / 搜尋與驗證問題

目標為 Chrome for Testing／ChromeDriver **156.0.8078.80**，
NopeCHA **0.6.1**；官方來源與雜湊見
[browser-toolchain.json](packaging/browser-toolchain.json)。
不混用Driver版本，不載入舊 ManifestV2 uBlock。

**r9 現行完整時間軸取樣未見 CAPTCHA，但未證明長期不再發生；
r8 的 CAPTCHA 尚未解決。** 以下是歷史 r8 問題診斷：新機包內
Chrome 的合成頁面幾何及捲動400px通過，
NopeCHA0.6.1為ENABLED、errors0，但Google六次10秒觀察均停在
`/sorry/index`／reCAPTCHA，圖片及捲動範圍均為0。第二輪完整循環的41筆
搜尋取樣有40筆挑戰頁，已載入圖片與捲動偏移最大值仍為0。
已比較同機、同版Chrome與同一隔離profile：一般Chrome由使用者確認看得到
圖片；停止後不載入NopeCHA、改由WebDriver開啟相同搜尋，四次5秒取樣仍為
CAPTCHA、0images／0loaded／0scrollRange。沿用人工profile與拿掉外掛並未
解決問題，差異集中在WebDriver啟動流程及附加選項；仍不是唯一觸發原因的證明。
尚未驗證人工重新整理是否穩定，亦未完成手動挑戰後的持續自動搜尋驗收。
使用者先前接受限制不等於搜尋已通過。

**歷史隔離試驗（現已整合為 r9）：** 先啟動一般 Chrome、再以官方
`debuggerAddress`連接既有Selenium的短試驗已成功。world news載入62張圖片，
連接及重新整理後仍正常，捲到792px；第二個elephant搜尋載入59張並捲到400px。
8筆取樣沒有CAPTCHA，除錯介面限定loopback且正常關閉。證據為
`evidence/ubuntu25-attach-probe.log`，prototype在`experiments/captcha-attach/probe.js`。
兩個搜尋不代表完整時間軸或長時間穩定；視窗要求1080×1920、0,0，
實際1079×1919、18,22的差異也需在正式桌面狀態重新驗證。
現行桌面入口使用 PM2 管理的 r9 stage3。以下為歷史 stage2 紀錄，當時安裝於
`/opt/transplayer/releases/r9.AppDir`，726項manifest及root權限通過，
stage2安裝封存SHA-256為
`06f5d25894ea05557084e66b2eff8593fa0d9a13b9d95ecb149375150acf4a03`；
原stage1封存SHA-256為
`db7c228b51e157dee2e372b5221fb12437554c0a53982a122f6f5ff10be8fc58`，
原AppDir完整保留在`/opt/transplayer/releases/r9-stage1.AppDir`。
實際包內模組world news／elephant分別載入62／59張，重新整理後各捲400px，
同profile關閉重開與Chrome／Driver／debugger清理通過。
新版extension只接受明確r8／r9路徑，revision2已於重新登入後實機載入。
完整時間軸的13個原始搜尋均載入圖片並捲動、151筆取樣沒有CAPTCHA；
首次完整影片觀察只見一次回零而失敗，見
`evidence/r9-stage2-full-cycle.log`；低干擾複驗第二次回零與結束還原
通過，見 `evidence/r9-low-impact-observer-20261030T164926Z.log`。
不自行登出或重開機。

部署後比較專用 profile 的人工搜尋與時間軸，記錄圖片載入、捲動與挑戰。
可由現場使用者手動完成驗證。不購買額度、不輪換代理、不用私人登入資料。
NopeCHA可能將挑戰內容送至第三方；證據不含cookie／token／密碼或任意頁面內容。

既有環境變數：

- `TRANSPLAYER_CONFIG`：外部JSON。
- `TRANSPLAYER_PROFILE_DIR`：專用profile根目錄；r8為`profiles-r8`，r9 stage1為`profiles-r9`，stage2來源改用`profiles-r9-basic`，不重用私人／Chrome87 profile。
- `TRANSPLAYER_BROWSER_BACKEND`：r9來源AppRun預設`chrome-first`；`webdriver`保留歷史啟動方式。chrome-first不自動載入NopeCHA，不能把來源預設當作r8已更新。
- `TRANSPLAYER_DESKTOP_BACKEND`：新AppRun預設 `gnome49`；舊桌面後端仍保留，但不可在新機任意切換以繞過驗證。
- `TRANSPLAYER_DISABLE_CAPTCHA_EXTENSION=1`：不載入NopeCHA。
- `TRANSPLAYER_CHROME`／`TRANSPLAYER_DRIVER`：開發指定同版二進位；AppRun使用包內路徑。
- `TRANSPLAYER_SMOKE_SECONDS`：短測試退出時間，不是正式循環驗收。

### Automatic login and keyring / 自動登入與鑰匙圈

使用者確認展示機已設定自動登入；重開後桌面、RustDesk與雙直向配置通過，
PM2 的登入後自啟項目已在使用者自行登入後觀察到單一線上播放器；
後續全畫面瀏覽器故障使可靠播放驗收仍未完成。
使用者已核准r9 stage2的展示專用Chrome使用`--password-store=basic`，
避免向系統登入鑰匙圈要求解鎖。**這個profile的密碼儲存不加密，
禁止登入私人帳號或儲存密碼。** 不修改系統鑰匙圈、其他Chrome、
RustDesk或sudo，不寫入或自動輸入任何帳號密碼。
stage2已安裝並通過實際basic參數／圖片／刷新／捲動／關閉重開測試，
使用者回報這次登入沒有鑰匙圈提示，但無獨立畫面錄影；先前鑰匙圈
已解鎖不能當成證明。模組只接受新空資料夾
或帶本程式展示標記的profile，不會套用到既有非展示profile。
原r9 stage1完整保留於`/opt/transplayer/releases/r9-stage1.AppDir`，
目前固定r9.AppDir已原子切換為stage2，精確AppArmor策略未改。
官方依據：https://chromium.googlesource.com/chromium/src/+/main/docs/linux/password_storage.md

## Development and build / 開發、測試與建置

測試需 Node **18+**、Python **3**：

```sh
npm test
```

使用 Node 內建 test runner，既有純模組保留 Node12 相容語法。
最新隔離來源完整 suite **97 pass／0 fail／0 skipped**，完整輸出存於
`evidence/r9-browser-recovery-full-20261031.log`；PM2 異常退出、
過期授權與瀏覽器殘留鎖的 red／green 證據見
[tests/README.md](tests/README.md)。此測試不代表新程式已部署。
以下是歷史建置階段結果：新機乾淨重建的完整 suite：
**50 pass／0 fail／0 skipped**；後續命令列修正的本機完整suite為
**52 pass／0 fail／0 skipped**，含新增擁有者／攻擊輸入／恢復與AppDir捷徑測試，
但不代表extension真機或新機播放驗收。完整建置／測試紀錄：
`evidence/ubuntu25-bootstrap.log`；先寫失敗測試的紀錄為
`evidence/desktop-modern-red.log`／`evidence/ubuntu25-launch-red.log`。
Electron45命令列回歸測試red／完整green紀錄：
`evidence/ubuntu25-title-red.log`／`evidence/ubuntu25-title-green.log`。
正式短測試失敗及安全還原紀錄：
`evidence/ubuntu25-playback-smoke.log`／`evidence/ubuntu25-post-login-safe-state.log`。
後續實機短測試為`evidence/ubuntu25-playback-smoke-v2.log`；
長觀察失敗與事件驅動通過分別為`evidence/ubuntu25-full-cycle.log`及
`evidence/ubuntu25-full-cycle-v2.log`。通過輪末筆19676 frames／854 dropped
（約4.34%），主程序RSS約164–166MiB；不是整組程序總記憶體。
掉幀與觀察到第二次回零所需817.86秒需納入後續效能／現場品質驗收。
runtime失敗完整紀錄：
`evidence/ubuntu25-runtime-gate.log` 與 `evidence/ubuntu25-runtime-gate-v2.log`，
`evidence/ubuntu25-runtime-gate-v3.log`與`evidence/ubuntu25-runtime-debug.log`。
Electron45通過紀錄為`evidence/ubuntu25-electron45-gate.log`。
保留全部失敗，不把初次建立視窗當成通過。

`npm start`僅開發入口；repo不附影片或Linux工具鏈，不能以
`npm install && npm start`取代完整安裝。現有offline builder：

```sh
python3 packaging/build-portable.py \
  --legacy /absolute/path/verified-runtime-installation \
  --browser-archives /absolute/path/locked-browser-archives \
  --output /absolute/path/new-release.AppDir
python3 packaging/build-appimage.py \
  --tool /absolute/path/verified-appimagetool.AppImage \
  --appdir /absolute/path/new-release.AppDir \
  --output /absolute/path/new-release.AppImage
```

`--legacy`名稱沿用舊介面，目前需已核對的Electron45.1.0／非dev modules；
乾淨重建使用官方Node24.22.2、`npm ci --ignore-scripts`與官方Electron archive，
跳過安裝腳本後將已校驗runtime放入`node_modules/electron/dist`再建置。
瀏覽器archive按lock存成`chrome.zip`、`chromedriver.zip`、
`nopecha-0.6.1-chromium.zip`。全程一般帳號，不全域npm安裝。
目前保留的舊Selenium／OSC相依鏈仍有npm audit警告；先前metadata檢查報告
7項（1 low／1 moderate／5 high），尚未修復，沒有自動執行audit fix或升級作品邏輯。
AppImage工具鎖在 [toolchain.json](packaging/toolchain.json)。輸出不可覆寫。

專案入口：

- `main.js`／`app/`：透明播放器、frame／時間回報、正常停止。
- `portable.js`：外部設定與螢幕範圍驗證。
- `web-process-new.js`／`controller.js`：圖片時間軸、視窗、捲動與profile。
- `sub-process.js`：只綁localhost:8080的OSC WebSocket bridge。
- `desktop-state.js`／`desktop-guard.js`：保留的舊GNOME後端。
- `desktop-modern-guard.js`／`desktop-client.js`／`packaging/gnome49/`：新機的持續DBus連線與受限桌面lease。
- `packaging/`：鎖檔、建置、AppRun、捷徑安裝。
- `tests/`：單元回歸與人工程序；`evidence/`保留gitignored完整輸出。

## Acceptance and history / 驗收與歷史資料

已驗證新機 runtime／sandbox、extension revision2、重登後雙直向、
影片 775→0 及完整循環、13 次真實搜尋圖片／捲動、PM2 短測的
音訊／穿透／接縫與正常停止。精確預設瀏覽器視窗幾何未通過，
掉幀 10.44% 為已接受觀感但未消除的限制。受控異常斷線的
租約回復與 PM2 重啟、實際桌面入口起停及人工觸發的 autostart
項目均已通過；PM2 登入後確實啟動一個無時限播放器，但全畫面搜尋
瀏覽器後來間歇消失、原登入檢查又因自動 dump 斷言失敗。
修正版本尚未在實機部署及驗證，代表性連續 soak 也未完成；
不可宣稱正式可靠交付。

- [目前Ubuntu25.10部署與回復](tests/manual/ubuntu25-r8.md)
- [歷史Ubuntu18.04／X11完整指南](tests/manual/ubuntu18-installation.md)
- [歷史Google r7b](tests/manual/google-r7.md)
- [歷史DuckDuckGo r6](tests/manual/duckduckgo-r6.md)
- [舊環境人工驗證](tests/manual/portable.md)

歷史文件的PID、PM2／捷徑與雜湊只適用原機，不代表新機狀態。
