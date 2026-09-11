# Sumi Club／墨間牌社實作計畫

> 執行技能：superpowers:executing-plans；按里程碑實作、驗證並記錄證據。

**目標：** 建立可靜態託管的立體大老二遊戲，支援 1–3 CPU 與 2–4 真人。
**架構：** 純函式規則引擎、獨立 CPU 決策、DOM 無障礙手牌、three.js 立體牌桌、d3.js 手牌分布。連線由房主驗證動作，僅將各人的手牌傳給本人；WebRTC 手動交換 SDP，不需要應用程式後端。
**技術：** HTML、CSS、Vanilla JavaScript ES Modules、three.js、d3.js。Node 僅用於開發靜態伺服器與測試。
**設計規格：** ART-DIRECTION.md 與本文件桌規。

## 範圍與桌規

- 2–4 人，每人 13 張，剩餘牌不使用。已發出最小牌持有者先手，第一手必須包含該牌。
- 點數 3 < 4 < … < K < A < 2；花色 ♦ < ♣ < ♥ < ♠。
- 1 張單張、2 張同點對子、3 張同點三條；5 張順子 < 同花 < 葫蘆 < 鐵支帶一 < 同花順。
- 順子只允許 34567 至 10JQKA；2 不參與順子。順子同級比最高牌花色；同花先比花色，再逐張比點數；葫蘆／鐵支比較三條／四條點數。
- 只能以相同張數壓牌；沒有跨張數炸彈。其他人都過牌後，最後出牌者自由領出；過牌不代表永久退出該輪。先清空手牌者勝，全局結束。
- CPU 四級：入門隨機合法牌；標準優先出多張與小牌；進階保留組合；高手評估剩餘組合並在對手即將出完時封鎖。不讀取對手手牌。
- 不含帳號、金流、排行榜伺服器、自動配對、斷線接續或競技防作弊。房主可信任；連線碼包含連線位址資訊，只交給同行玩家。

## 里程碑與工作分解

- [x] M1 規則：建立 src/rules.js、src/ai.js、tests/rules.test.js。先執行缺少模組的紅燈測試，再實作 classify(cards)、beats(cards,last)、newGame(names)、act(state,seat,cards)、chooseMove(state,seat,level)。驗證 52 張唯一性、合法牌型、最小牌起手、過牌重置、非法動作不改狀態、完整 CPU 對局。
- [x] M2 牌桌：index.html、styles.css、src/main.js、src/table.js、src/stats.js。規則控制 UI，three.js 繪製有厚度紙牌及洗牌／發牌／出牌動畫；DOM 按鈕控制手牌。驗證桌機與手機截圖、鍵盤操作、提示／過牌／勝負流程、降低動態效果。
- [x] M3 連線：src/network.js、tests/browser.mjs。邀請每位客人使用獨立 offer/answer，房主固定座位且驗證版本與動作；僅傳送本人手牌。驗證逐位入座、四個瀏覽器頁面真實 WebRTC 完整對局與再開局、錯誤碼、斷線鎖定；權限由純函式測試覆蓋。
- [x] M4 交付：README.md、TEST-PLAN.md、LICENSE、CONTRIBUTING.md、.gitignore。執行 Node 測試與瀏覽器測試，獨立程式碼審查與修正。證據見 VERIFICATION.md。
- [x] M5 Git：在獨立 sumi-club 目錄初始化 feature/sumi-club，僅加入明確列出的專案檔案。推送前已顯示 remote、branch、commit。初始提交 00f8ab2 已成功推送至 https://github.com/andychung0214/sumi-club.git 的 feature/sumi-club，並以 git ls-remote 核對遠端提交一致。

## 驗收與風險

- 全部核心測試通過；1–3 CPU 可完成對局，四級策略皆只出合法牌。
- 桌機與 390px 手機無水平溢位；遊戲按鈕可鍵盤操作，狀態有 aria-live。
- WebGL 不可用時仍能用 DOM 遊玩；localStorage 不可用時仍能開始遊戲。
- 同一主機瀏覽器的 WebRTC 測試不代表跨 NAT 連線保證；STUN 為外部服務，無 TURN 中繼。異常要顯示可操作的錯誤。
- ES Modules 必須由 HTTP(S) 載入，不承諾 file:// 雙擊。發佈不需要建構，函式庫隨專案提供。
- 不讀取、列印、提交或推送憑證、token、.env、私人金鑰。
