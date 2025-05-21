# WingChat - AI 社交教練

本專案是一個 AI 社交教練應用程式，旨在幫助使用者練習和提升社交技能。它使用了 React 作為前端框架，Python Flask 作為後端 API，並整合了 Ollama 來運行本地大型語言模型。

## 專案架構

*   **前端 (React)**: 位於 `src` 目錄，處理使用者介面和交互邏輯。
*   **後端 (Python Flask)**: 位於根目錄的 `app.py`，作為前端和 Ollama 服務之間的中介 API，負責構建 Prompt、調用 Ollama 並對回應進行後處理。
*   **Ollama**: 本地運行的大型語言模型服務。

## 開始使用

### **先決條件**

在開始之前，請確保你已經安裝了以下軟體：

1.  **Node.js 和 npm**: 用於運行 React 前端。你可以從 [Node.js 官網](https://nodejs.org/)下載。
2.  **Python 3**: 用於運行 Flask 後端。你可以從 [Python 官網](https://www.python.org/)下載。
3.  **Ollama**: 用於運行本地大型語言模型。你可以從 [Ollama 官網](https://ollama.com/)下載並根據你的作業系統進行安裝。

### **步驟 1: 設定 Ollama 及自定義模型**

1.  **安裝 Ollama**:
    請依照 [Ollama 官網](https://ollama.com/) 的指示安裝 Ollama。

2.  **準備 Modelfile**:
    你需要一個 `Modelfile` 來定義你的自定義模型。這個檔案描述了基礎模型、系統提示、參數等。例如，你的 `Modelfile` 可能類似這樣 (假設檔名為 `my-custom-llama3.Modelfile` 或直接命名為 `Modelfile` 並放在特定目錄)：

    ```modelfile
    # Modelfile 範例 (請根據你的實際 Modelfile 調整)
    FROM llama3:latest # 或者你使用的其他基礎模型

    # 參數 (可選)
    PARAMETER temperature 0.7
    PARAMETER top_p 0.9
    # ... 其他參數

    # 系統提示 (可選, 如果你的主要系統提示在 Python 後端構建，這裡可以簡化或省略)
    SYSTEM """你是一個友善且樂於助人的 AI 聊天夥伴。"""

    # 模板 (如果基礎模型需要特定模板，通常 Llama 3 會自動處理)
    # TEMPLATE """<|begin_of_text|><|start_header_id|>system<|end_header_id|>{{ .System }}<|eot_id|><|start_header_id|>user<|end_header_id|>{{ .Prompt }}<|eot_id|><|start_header_id|>assistant<|end_header_id|>"""
    ```

3.  **創建 (或拉取) Ollama 模型**:
    打開終端，進入包含你的 `Modelfile` 的目錄（或者如果 `Modelfile` 在專案根目錄，則在專案根目錄下執行），然後運行以下命令來創建你的自定義模型。假設你的自定義模型名稱為 `my-custom-llama3` (這應與 `app.py` 中的 `DEFAULT_MODEL_NAME` 或前端傳遞的模型名稱對應)：

    ```bash
    ollama create my-custom-llama3 -f ./Modelfile
    ```
    *   將 `my-custom-llama3` 替換為你實際想用的模型名稱。
    *   將 `./Modelfile` 替換為你 `Modelfile` 的實際路徑和檔名。
    *   如果你的 `Modelfile` 中 `FROM` 指令引用的基礎模型 (例如 `llama3:latest`) 尚未下載，Ollama 會自動嘗試拉取它。你也可以手動拉取：`ollama pull llama3:latest`。

4.  **運行 Ollama 服務**:
    通常情況下，安裝完 Ollama 後，其服務會自動在背景運行。如果沒有，請根據你的作業系統啟動 Ollama 服務。它預設監聽在 `http://localhost:11434`。你可以通過訪問該地址來確認服務是否運行。

### **步驟 2: 設定並運行後端 API (Python Flask)**

1.  **進入專案根目錄**:
    打開終端，導航到包含 `app.py` 的專案根目錄。

2.  **創建虛擬環境 (推薦)**:
    ```bash
    python -m venv venv
    source venv/bin/activate  # Linux/macOS
    # venv\Scripts\activate    # Windows
    ```

3.  **安裝 Python 依賴**:
    ```bash
    pip install Flask flask-cors requests
    ```
    (如果專案中有 `requirements.txt` 檔案，可以使用 `pip install -r requirements.txt`)

4.  **運行後端 API 服務**:
    ```bash
    python app.py
    ```
    後端服務預設會運行在 `http://localhost:5001`。你會在終端看到 Flask 的啟動訊息。

### **步驟 3: 設定並運行前端應用 (React)**

1.  **進入前端專案目錄**:
    如果你的 React 專案結構是標準的 Create React App，通常根目錄就是前端專案目錄。如果你的 `app.py` 和前端 `package.json` 在同一級目錄，則保持在該目錄即可。

2.  **安裝 Node.js 依賴**:
    ```bash
    npm install
    ```

3.  **配置 API URL (可選)**:
    前端應用程式會嘗試連接到後端 API (預設 `http://localhost:5001`) 和 Ollama (如果 `getFeedbackFromOllama` 函數直接調用，預設 `http://localhost:11434`)。
    這些 URL 在 `src/services/ollamaService.js` 中定義，並可以通過 `.env` 文件中的環境變數進行覆蓋：
    *   `REACT_APP_PYTHON_API_URL`: Python Flask 後端 API 的 URL。
    *   `REACT_APP_OLLAMA_API_URL`: Ollama 服務的 URL。

    如果你的後端或 Ollama 運行在不同的地址或端口，可以創建一個 `.env` 文件在專案根目錄，並填寫如下內容：
    ```env
    REACT_APP_PYTHON_API_URL=http://your-backend-host:your-backend-port
    REACT_APP_OLLAMA_API_URL=http://your-ollama-host:your-ollama-port
    ```

4.  **啟動前端開發伺服器**:
    ```bash
    npm start
    ```
    這會在開發模式下運行應用程式。
    打開瀏覽器並訪問 [http://localhost:3000](http://localhost:3000) 即可查看。

    當你修改程式碼時，頁面會自動重新加載。你也可以在控制台中看到任何語法錯誤。

## 主要功能

*   **訓練室**: 與選擇的 AI 角色進行對話練習。
*   **角色館**: 新增、管理和選擇不同的 AI 角色進行互動。
*   **回饋牆**: 查看歷史對話的回饋總結和評分趨勢。

## 可用腳本 (前端)

在專案目錄中，你可以運行：

### `npm start`

在開發模式下運行應用程式。
打開 [http://localhost:3000](http://localhost:3000) 在瀏覽器中查看。

### `npm test`

以交互式觀察模式啟動測試運行器。
更多資訊請參閱 [運行測試](https://facebook.github.io/create-react-app/docs/running-tests)。

### `npm run build`

將應用程式構建到 `build` 文件夾以用於生產環境。
它會在生產模式下正確地打包 React 並優化構建以獲得最佳性能。

構建結果會被壓縮，且檔名包含哈希值。
你的應用程式已準備好部署！

更多資訊請參閱 [部署](https://facebook.github.io/create-react-app/docs/deployment)。

## 了解更多 (Create React App)

你可以在 [Create React App 文檔](https://facebook.github.io/create-react-app/docs/getting-started) 中了解更多資訊。

要學習 React，請查看 [React 文檔](https://reactjs.org/)。