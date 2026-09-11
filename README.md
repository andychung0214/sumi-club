# 墨間牌社 · Sumi Club

一桌四席，一手好牌。深綠絨布、暖白紙牌與黃銅細節的立體大老二遊戲。

## 特色

- 對戰 1–3 位 CPU，四級策略：入門、標準、進階、高手。CPU 不讀取其他人的手牌。
- 2–4 人 WebRTC 好友對戰：每位客人與房主交換一次邀請碼／回覆碼。
- three.js 繪製有厚度的紙牌與洗牌、發牌、出牌過場；WebGL 不可用時使用 HTML 牌面。
- d3.js 手牌點數分布、出牌紀錄、瀏覽器本日牌記、可切換音效。
- 桌機、平板與手機排版，原生按鈕鍵盤操作，支援降低動態效果偏好。

## 安裝與執行

環境：Node.js 20.19 以上，現代 Chrome／Edge／Firefox／Safari（目前自動化驗證以 Chrome 為主）。

```sh
npm ci
npm start
```

開啟 http://127.0.0.1:4173 。`npm start` 只提供本機靜態檔案，不是遊戲後端。若不需要開發工具，專案已包含 vendor 函式庫，也可直接使用其他靜態 HTTP 伺服器。

**不要以 file:// 雙擊開啟**：原生 ES Modules 需要 HTTP(S) 來源。

## 操作方式

1. 選擇電腦人數與程度，按「入座開局」。對戰中可調整程度；人數在下一局套用。
2. 點選或觸控手牌，再按「出牌」。選中牌會上移並有金框。
3. 「提示」僅選出建議牌，不會代為出牌。無合法牌可以按「過牌」。
4. 鍵盤：Tab 移動焦點、Space／Enter 操作聚焦按鈕。焦點不在表單或按鈕時，H 提示、P 過牌、Enter 出牌、Esc 清空選牌。Esc 也可關閉對話框。
5. 「桌規」查看本作規則；「出牌紀錄」查看最近 40 手與手牌分布。先清空手牌即結束本局。

### 好友連線

1. 每人開啟同一份 HTTPS 網站（本機測試可用 localhost），選「好友連線」→「開啟連線室」。
2. 房主按「我是房主」→「產生下一位邀請碼」，將完整邀請碼傳給一位朋友。
3. 朋友按「我要加入」，貼入邀請碼，按「套用連線碼」，將產生的回覆碼傳回房主。
4. 房主貼入回覆碼並套用，等候顯示已連線。每位朋友重複 2–4 步，最多 3 位。
5. 房主按「全員入座，開局」。不需全滿，2 人也可玩。
6. 邀請失敗可取消該邀請再產生新的；對局中任一人斷線，全桌暫停並提示重建房間。重新整理不會恢復對局。

連線碼含 SDP／網路位址，只交給要一起玩的朋友；不儲存到 localStorage。STUN 使用 `stun.l.google.com:19302`，需網路與服務可用。沒有 TURN 中繼、信令服務或自動配對，**無法保證不同 NAT、防火牆、公司網路與行動網路皆能互通**。測試中的多瀏覽器連線成功不代表所有跨網路環境可用。

## 墨間桌規

- 2–4 人各 13 張；其他牌不使用。已發出最小牌先行，首手必須包含它（四人即 ♦3）。
- 3 < 4 < … < K < A < 2；♦ < ♣ < ♥ < ♠。
- 單張、對子、三條，或五張牌：順子 < 同花 < 葫蘆 < 鐵支帶一 < 同花順。
- 順子只接受 34567 至 10JQKA，2 不入順。同順子比較最高牌花色。
- 同花先比花色，再逐張比較點數。葫蘆比三條點數，鐵支比四條點數。
- 相同張數才能壓牌，沒有跨張數炸彈。其他人都過牌後，由最後出牌者自由領出。
- 過牌不會使玩家永久退出該輪；先清空手牌者勝，全局立即結束。

這是明確固定的地方桌規，不宣稱涵蓋所有台灣／香港變體。規則參考：[Pagat Big Two](https://www.pagat.com/climbing/bigtwo.html)。

## 專案結構

```text
index.html            牌桌、設定及對話框
styles.css            視覺、RWD 與無障礙焦點
src/rules.js          純函式牌型、回合與合法動作
src/ai.js             四種 CPU 策略
src/main.js           互動、回合排程、連線房間
src/table.js          three.js 紙牌與動畫
src/network.js        WebRTC 與訊息格式驗證
src/stats.js          本日紀錄與 d3 圖表
vendor/               固定版本 three.js、d3.js 與授權
assets/               自製 SVG 標誌
scripts/serve.mjs      本機靜態伺服器
tests/                Node 與 Playwright 測試
docs/                 計畫、視覺與測試文件
```

## 測試方式

```sh
npm test
# 另一個終端保持 npm start 執行
npm run test:browser
npm run test:resilience
```

瀏覽器測試使用安裝於電腦的 Google Chrome；可設定 `BROWSER_CHANNEL=msedge` 改用 Edge。Playwright 僅為開發依賴。輸出截圖與結果在 `artifacts/`，不加入 Git。詳見 [測試計畫](docs/TEST-PLAN.md) 與 [驗證紀錄](docs/VERIFICATION.md)。

## 靜態網站託管

不需建構：上傳 `index.html`、`styles.css`、`assets/`、`src/`、`vendor/` 到任意 HTTPS 靜態網站，例如 GitHub Pages、NAS Web Station。所有網址使用相對路徑，可部署至子目錄。不需要部署 `node_modules`、測試或本機伺服器。託管端需將 `.js` 提供為 JavaScript MIME 類型。

本交付包含 Git 提交與推送，不代表已啟用 GitHub Pages 或完成 NAS 部署。

## 已知限制

- 房主擁有全副牌並負責裁定，適合同伴休閒；不具競技防作弊、帳號驗證或公平洗牌證明。洗牌使用 Fisher–Yates 與 Math.random，非金流用途。
- 無跨網路連線保證、斷線接續、旁觀、自動配對或雲端戰績。
- 本日牌記只在本機 localStorage 儲存，依本機日期重置；瀏覽器封鎖儲存時遊戲仍可玩但不保存紀錄。
- CPU 是啟發式策略，四級不代表保證的難度評分；電腦不會假裝真人。
- WebGL 不可用時過場簡化為 HTML 牌面；螢幕閱讀器與真實 iOS／Android 裝置仍需人工補驗。

## 授權

本專案原創程式碼與標誌使用 [MIT](LICENSE)。three.js 0.180.0 使用 MIT，d3.js 7.9.0 使用 ISC，授權原文附於 `vendor/`。紙牌紋理由程式繪製，沒有第三方照片、付費字型或素材。

WebRTC 技術參考：[MDN Connectivity](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Connectivity)、[Data channels](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Using_data_channels)。
