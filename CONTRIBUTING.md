# 參與墨間牌社

使用 Node.js 20.19 以上與原生 JavaScript。不得引入 React、Angular、Vue、TypeScript、後端或大型遊戲引擎。

1. 分支使用 `feature/xxx`、`fix/xxx`、`chore/xxx`。
2. 修改規則先補重現測試，確認失敗後修正；規則與 DOM 保持獨立。
3. 執行 `npm test`。互動或網路異動還需 `npm start` 與 `npm run test:browser`，人工檢查桌機與手機。
4. PR 說明具體問題、修改後行為、測試結果與未驗證範圍。
5. Commit 採 Conventional Commits，描述用繁體中文，例如 `fix: 修正客人離線時的牌桌狀態`。
6. 不加入憑證、token、.env、私人金鑰、node_modules 或個人連線碼。Git 使用系統既有認證，不在 URL 寫入憑證。

中文使用「建立、資料、資訊、訊息、品質、整合、函式庫、套件、元件、執行、儲存」。
新增第三方資源需記錄版本與授權；更新 vendor 時同時更新 lockfile 與授權文件。
維持鍵盤焦點、原生按鈕、aria-live、觸控與 prefers-reduced-motion。避免只用顏色辨認狀態。
