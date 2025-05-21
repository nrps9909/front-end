// src/services/ollamaService.js
import axios from 'axios';

const PYTHON_API_BASE_URL = process.env.REACT_APP_PYTHON_API_URL || 'http://localhost:5001';
const OLLAMA_DIRECT_API_URL = process.env.REACT_APP_OLLAMA_API_URL || 'http://localhost:11434';

/**
 * 發送訊息到我們的 Python 後端 API
 * @param {string} goal 當前聊天目標
 * @param {Array<{role: 'user' | 'assistant', content: string}>} messages 包含歷史訊息的陣列
 * @param {{name: string, description: string}} character 當前選擇的角色
 * @returns {Promise<string>} AI 回應的文字
 */
// *** `model` 參數已移除，因為後端會決定使用哪個模型 ***
export const sendMessageToOllama = async (goal, messages, character) => {
  const apiUrl = `${PYTHON_API_BASE_URL}/api/chat_py`;

  const payload = {
    goal: goal,
    character: character,
    messages: messages,
    // model: model, // *** 不再傳遞 model 參數給後端 ***
  };

  console.log("Sending message to Python backend (/api/chat_py):", payload);

  try {
    const response = await axios.post(apiUrl, payload, { timeout: 70000 });

    console.log("Python backend response:", response.data);

    if (response.data && response.data.message && typeof response.data.message.content === 'string') {
      return response.data.message.content.trim();
    } else if (response.data && response.data.error) {
      console.error("Error from Python backend:", response.data.error);
      throw new Error(`AI 服務錯誤: ${response.data.error}`);
    } else {
      console.error("Unexpected response structure from Python backend:", response.data);
      throw new Error('從 Python AI 服務收到的回應結構無效');
    }
  } catch (error) {
    console.error(`Error in sendMessageToOllama (calling Python backend):`, error.response ? error.response.data : error.message, error.code);
    let errorMessage = `與 AI 服務通訊時發生錯誤。`;
    if (error.code === 'ECONNABORTED') {
        errorMessage = '連接 AI 服務超時，請稍後再試。';
    } else if (error.response && error.response.data && error.response.data.error) {
        errorMessage = `AI 服務錯誤: ${error.response.data.error}`;
    } else if (error.response) {
        errorMessage = `AI 服務錯誤 (狀態碼: ${error.response.status})。`;
    } else if (error.request) {
        errorMessage = '無法連接到 AI 服務。請檢查後端服務是否正在運行以及網路連接是否正常。';
    } else {
        errorMessage = error.message || '發生未知錯誤。';
    }
    if (errorMessage instanceof Error) { throw errorMessage; }
    else { throw new Error(errorMessage); }
  }
};

// getFeedbackFromOllama 函數 (保持原樣，直接調用 Ollama)
// *** 注意: 此函數仍然需要 model 參數。如果也想讓後端控制，需要創建新的後端端點 ***
export const getFeedbackFromOllama = async (goal, messages, character, model = 'my-custom-llama3') => { // 預設模型仍為 my-custom-llama3
    const apiUrl = `${OLLAMA_DIRECT_API_URL}/api/chat`;

    const feedbackSystemPrompt = `### **[絕對規則] 目標輸出風格 (MUST FOLLOW RULES):**
*   **核心要求 (Core Requirement)**: 100% 模仿台灣大學生用 LINE 聊天。輸出**必須極度簡短**！每個概念都必須拆成獨立的短訊息，並且**只能**使用換行符 \`\\\\n\` 來分隔這些短訊息。
*   **絕對禁止 (ABSOLUTELY FORBIDDEN - DO NOT USE):**
    *   **任何 Emoji**。 *   **逗號** \`,\`。 *   **句號** \`.\` 或 \`。\`。 *   **引號** \`"\` \`'\` 「」 『』。
    *   **頓號** \`、\`。 *   **分號** \`;\` 或 \`；\`。 *   **冒號** \`:\` 或 \`：\`。 *   **括號** \`()\` \`（）\` \`[]\`。
    *   **任何項目符號或列表標記**。 *   **任何 \\"話翼:\\" 或類似的角色/機器人名稱前綴**。
*   **唯一允許的標點 (ONLY ALLOWED PUNCTUATION):**
    *   **空格** \` \`。 *   **換行符** \`\\\\n\`。 *   **問號** \`？\` (少量)。 *   **驚嘆號** \`！\` (少量)。
*   **訊息長度 (Message Length)**: 總回覆非常簡短。1 到 4 個 \`\\\\n\` (2 到 5 則短訊息)。
*   **輸出格式範例 (Output Format Examples):**
    *   範例 1:\\\\n喔喔\\\\n原來是這樣
    *   範例 2:\\\\n欸\\\\n那你想去哪\\\\n我看看時間
    *   範例 3:\\\\n哈哈\\\\n真的假的\\\\n笑死

You are an expert AI social skills evaluator.
Analyze the following conversation where the user practiced the social goal "${goal}" while interacting with the persona "${character.name}" (${character.description}).
Based *only* on the User's messages in the conversation history, provide:
1.  A concise [Feedback Summary] (less than 150 words, in Traditional Chinese) of the user's performance, highlighting strengths and areas for improvement regarding the stated goal and general social skills.
2.  A [Scores] section with numerical ratings (0-100) for the following aspects of the user's communication:
    - Clarity: (0-100)
    - Empathy: (0-100)
    - Confidence: (0-100)
    - Appropriateness: (0-100)
    - Goal Achievement: (0-100, how well the user pursued their stated goal)

Strictly follow this output format. Do not add any extra conversational text or introductions before "[Feedback Summary]".
Example for [Scores] section:
[Scores]
Clarity: 80
Empathy: 70
Confidence: 75
Appropriateness: 85
Goal Achievement: 90`;

    const conversationText = messages.map(m => `${m.role === 'user' ? 'User' : character.name}: ${m.content}`).join('\\n');
    const feedbackUserPrompt = `Conversation History:\n${conversationText}\n\nPlease provide your evaluation of the User's performance based on the instructions.`;
    const requestMessages = [
        { role: 'system', content: feedbackSystemPrompt },
        { role: 'user', content: feedbackUserPrompt }
    ];

    try {
        console.log("Sending feedback request directly to Ollama:", { model, messages: requestMessages });
        const response = await axios.post(apiUrl, {
            model: model, // 傳遞給 Ollama 的模型名稱
            messages: requestMessages,
            stream: false,
            options: { temperature: 0.3 }
        }, { timeout: 90000 });
        console.log("Ollama feedback response:", response.data);
        if (response.data && response.data.message && response.data.message.content) {
            return response.data.message.content.trim();
        } else {
            console.error("Unexpected feedback response structure:", response.data);
            throw new Error('從 Ollama API 收到的回饋回應結構無效');
        }
    } catch (error) {
        handleOllamaError(error, 'getFeedbackFromOllama (direct)');
    }
};

// 統一的錯誤處理函數 (保持不變)
function handleOllamaError(error, functionName) {
    console.error(`Error in ${functionName}:`, error.response ? error.response.data : error.message, error.code);
    let errorMessage = `與 AI (${functionName}) 通訊時發生錯誤。`;
    if (error.code === 'ECONNABORTED') {
        errorMessage = '連接 AI 超時，請稍後再試。';
    } else if (error.response) {
        if (error.response.data && error.response.data.error) {
            if (error.response.data.error.includes("model not found")) {
                 let modelName = 'specified model';
                 try { if (error.config?.data) { modelName = JSON.parse(error.config.data).model; } }
                 catch (e) { /* ignore */ }
                 errorMessage = `AI 模型 '${modelName}' 未找到。請確認 Ollama 已下載該模型。`;
            } else {
                errorMessage = `Ollama API 錯誤: ${error.response.data.error}`;
            }
        } else if (error.response.status) {
             errorMessage = `AI 伺服器錯誤 (狀態碼: ${error.response.status})。`;
        } else {
            errorMessage = `AI 伺服器返回了未知的錯誤結構。`;
        }
    } else if (error.request) {
        errorMessage = '無法連接到 AI 服務。請檢查 Ollama (或後端服務) 是否正在運行以及網路連接是否正常。';
    } else {
        errorMessage = error.message || '發生未知錯誤。';
    }
    if (errorMessage instanceof Error) { throw errorMessage; }
    else { throw new Error(errorMessage); }
}