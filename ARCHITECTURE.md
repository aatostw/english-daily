# 每日英文練習：程式結構

網址：https://english.natursai.com（GitHub Pages，`CNAME`）

## 三個部分

| 部分 | 在哪裡 | 做什麼 |
|---|---|---|
| 網頁 App | 這個 repo 的根目錄 | 畫面、學習流程、資料先存在手機（localStorage） |
| 伺服器 | `server/eel-api.js`，部署成 Cloudflare Worker `eel-api` + D1 資料庫 `eel-english` | 帳號、雲端同步、AI 代理、每日新聞、電腦語音轉接、帳號管理 |
| 電腦語音 | 你的電腦 `D:\GPT-SoVITS-v2pro-20250604\voice_server.py`，經 voice.natursai.com | GPT-SoVITS 朗讀、Whisper 跟讀評分 |

## 網頁 App 的檔案（依載入順序）

全部是一般 `<script>`，依序載入、共用全域變數；不需要建置工具。

| 檔案 | 內容 |
|---|---|
| `js/clock.js` | 開發人員測試時間（改寫 Date） |
| `js/data.js` | 課程資料：句型、難度、每週主題、範例文章 |
| `js/core.js` | 全域狀態 `S`、小工具（`$`、`esc`、日期） |
| `js/store.js` | `Store`：讀寫 localStorage，每次變動通知雲端 |
| `js/cloud.js` | `Cloud`：登入、上傳／下載同步、`reloadFromStore` |
| `js/ai.js` | AI 服務商（伺服器／Gemini／OpenAI／Anthropic／自訂）、`callAI`（忙碌重試＋換模型） |
| `js/tts.js` | `TTS`：系統聲音、Pocket TTS、GPT-SoVITS，自動依序備援 |
| `js/prompts.js` | 給 AI 的提示詞 |
| `js/article.js` | 文章標記解析與顯示（`renderBody`） |
| `js/render.js` | `render()`：依 `S.view` 畫出目前頁面 |
| `js/city.js` | 我的城市：資料、規則（道路、門、居民）；v2 升級：每 3 級一階（`tierOf`、`bStat`），市中心 6 階（`HALL_TIERS`、`EVOLVE`、`evolveTasks`），農田/咖啡店/書店/診所/地標的產出（`cityDaily`、`cityStudied`） |
| `js/city3d.js` | `City3D`：Three.js 3D 城市 |
| `js/city3d-tiers.js` | 7 個時代 × 每個時代 3 級的建築 3D 外觀（`City3D.tierModel`）；預覽頁 `tools/models.html` |
| `js/pages.js` | 首次設定、首頁、學習進度、對話、收藏 |
| `js/about.js` | 關於我：年齡區間、性別、興趣（新手引導第 3–5 步、設定頁、給 AI 的學習者描述、興趣主題）|
| `js/settings.js` | 設定各頁、登入畫面、帳號與帳號管理 |
| `js/reader.js` | 閱讀頁、單字解釋、選取解釋、跟讀評分 |
| `js/course.js` | 產生每週內容和每日文章（呼叫 AI） |
| `js/news.js` | 每日新聞卡片與閱讀頁 |
| `js/rewards.js` | 學習紀錄、金幣、知識、學習歷程的資料（`logResult`、`logScore`） |
| `js/progress.js` | 學習歷程（時間軸、趨勢、掌握度、預估）和月考 |
| `js/actions.js` | `ACT`：所有 `data-act` 按鈕的動作，和事件監聽 |
| `js/boot.js` | 啟動：同步 → 載入資料 → 畫面 |
| `css/app.css` | 全部樣式 |
| `sw.js` | 離線快取、跨來源隔離標頭（Pocket TTS 需要） |
| `tools/release.py` | 每次上線前執行：版本號加一，並加到所有 css/js 網址上，避免手機混用新舊檔案 |

### 慣例
- 畫面都是字串組 HTML，再由 `render()` 放進 `#main`；按鈕用 `data-act="名稱"`，動作寫在 `ACT`。
- 資料一律用 `Store.set/get/del/list`，不要直接寫 localStorage（不然不會同步）。
- 只存在這台裝置、不同步的：`eel-cloud`（登入）、`eel-admin`（管理員）、`eel-time-offset`（測試時間）、模型清單和查詢快取。

## 伺服器（Cloudflare Worker `eel-api`）

設定（Cloudflare → eel-api → Settings → Variables and Secrets）：

| 名稱 | 類型 | 用途 |
|---|---|---|
| `DB` | D1 綁定 | 資料庫 `eel-english` |
| `ADMIN_USER` | 變數 | 管理員帳號 |
| `ADMIN_KEY` | Secret | 管理密碼 |
| `GEMINI_KEY` | Secret | 伺服器 AI 和每日新聞用的 Gemini 金鑰 |
| `VOICE_KEY` | Secret | 電腦語音伺服器的密碼（`voice_server_key.txt`） |
| `AI_DAILY` | 變數（選填） | 每人每天 AI 次數，預設 300 |
| `NEWS_MODEL`、`NEWS_BACKUPS` | 變數（選填） | 新聞用的模型與備用模型 |

排程：每天 22:00 UTC（台灣 06:00）產生當天新聞。

主要路徑：`/login` `/me` `/password` `/forgot` `/sync` `/news` `/ai/models/...` `/voice/...` `/admin/...`。
資料表會在第一次呼叫時自動建立。
