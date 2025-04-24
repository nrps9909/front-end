import axios from 'axios';

// 從環境變數讀取 API URL，若無則使用預設值
const OLLAMA_API_URL = process.env.REACT_APP_OLLAMA_API_URL || 'http://localhost:11434';

/**
 * 發送訊息到 Ollama API (用於對話)
 * @param {string} goal 當前聊天目標
 * @param {Array<{role: 'user' | 'assistant', content: string}>} messages 包含歷史訊息的陣列
 * @param {{name: string, description: string}} character 當前選擇的角色
 * @param {string} model 要使用的 Ollama 模型名稱 (例如 'llama3.2:latest') // <--- 修改註解
 * @returns {Promise<string>} AI 回應的文字
 */
//                                                                    vvvvvvvvvvvvvvvvv
export const sendMessageToOllama = async (goal, messages, character, model = 'llama3.2:latest') => {
  const apiUrl = `${OLLAMA_API_URL}/api/chat`;

  // 建構系統提示 (System Prompt)
  const systemPrompt = `You are WingChat, an AI social coach.
Your current persona is: ${character.name}.
Character description: ${character.description}. Strictly adhere to this persona in your responses, including tone and style.
The user's current social training goal is: "${goal}".
Engage in a conversation relevant to the user's goal, acting as the specified persona. Keep your responses concise, natural-sounding, and focused on the training objective. Avoid meta-commentary about being an AI unless it's part of the persona. Do not break character.`;

  // 組合完整的訊息列表
  const requestMessages = [
    { role: 'system', content: systemPrompt },
    ...messages // 包含 user 和 assistant 的歷史訊息
  ];

  try {
    console.log("Sending message to Ollama:", { model, messages: requestMessages });

    const response = await axios.post(apiUrl, {
      model: model, // 使用函數參數中的 model ('llama3.2:latest' 或傳入的值)
      messages: requestMessages,
      stream: false, // 獲取完整回應
      options: {
         temperature: 0.7, // 稍微增加一點創意性
         // num_ctx: 4096, // 可選：根據模型調整上下文窗口大小
      }
    }, { timeout: 60000 }); // 增加超時時間 (60秒)

    console.log("Ollama message response:", response.data);

    if (response.data && response.data.message && response.data.message.content) {
      return response.data.message.content.trim();
    } else {
      console.error("Unexpected response structure:", response.data);
      throw new Error('從 Ollama API 收到的回應結構無效');
    }

  } catch (error) {
    handleOllamaError(error, 'sendMessageToOllama'); // 使用統一的錯誤處理函數
  }
};

/**
 * 向 Ollama 請求對話回饋
 * @param {string} goal 聊天目標
 * @param {Array<{role: 'user' | 'assistant', content: string}>} messages 對話歷史
 * @param {{name: string, description: string}} character 互動的角色
 * @param {string} model 模型名稱 (例如 'llama3.2:latest') // <--- 修改註解
 * @returns {Promise<string>} AI 回饋的文字 (包含分數和總結，需要前端解析或進一步處理)
 * @throws {Error} If the API call fails or returns an unexpected structure.
 */
//                                                                       vvvvvvvvvvvvvvvvv
export const getFeedbackFromOllama = async (goal, messages, character, model = 'llama3.2:latest') => {
    const apiUrl = `${OLLAMA_API_URL}/api/chat`;

    // 構建一個用於請求回饋的 Prompt
    // **重要**: 這個 Prompt 需要精心設計，讓 LLM 返回結構化的數據 (分數和總結)
    const feedbackPrompt = `You are an expert AI social skills evaluator. Analyze the following conversation where the user practiced the social goal "${goal}" while interacting with the persona "${character.name}" (${character.description}).

Conversation History:
${messages.map(m => `${m.role === 'user' ? 'User' : character.name}: ${m.content}`).join('\n')}

Based *only* on the user's messages in the conversation history provided, please evaluate the user's performance according to the social goal "${goal}". Provide feedback focusing on the user's clarity, empathy, confidence, appropriateness, and goal achievement.

Output your feedback in the following format ONLY. Do not add any extra text before or after this structure:

[Feedback Summary]
Provide a concise summary (2-3 sentences) of the user's overall performance regarding the goal "${goal}". Mention specific strengths and areas for improvement based on their messages.

[Scores]
Clarity: [Score from 0-100]
Empathy: [Score from 0-100, if applicable to the goal, otherwise N/A]
Confidence: [Score from 0-100]
Appropriateness: [Score from 0-100]
Goal Achievement: [Score from 0-100, how well they addressed the core goal]

Provide numerical scores only, without any explanation after the score number. If a category is not applicable (e.g., Empathy in a technical introduction), state N/A instead of a score.
`;

    // 只需要將 feedbackPrompt 作為 user message 發送給 AI
    const requestMessages = [
        { role: 'user', content: feedbackPrompt }
    ];

    try {
        console.log("Sending feedback request to Ollama:", { model, messages: requestMessages });

        const response = await axios.post(apiUrl, {
            model: model, // 使用函數參數中的 model ('llama3.2:latest' 或傳入的值)
            messages: requestMessages,
            stream: false,
            options: {
               temperature: 0.3, // 評估時降低隨機性
               // num_ctx: 4096,
            }
        }, { timeout: 90000 }); // 回饋請求可能需要更長時間

        console.log("Ollama feedback response:", response.data);

        if (response.data && response.data.message && response.data.message.content) {
            // 直接返回 AI 的原始回饋文本，前端需要解析
            return response.data.message.content.trim();
        } else {
            console.error("Unexpected feedback response structure:", response.data);
            throw new Error('從 Ollama API 收到的回饋回應結構無效');
        }

    } catch (error) {
        handleOllamaError(error, 'getFeedbackFromOllama');
    }
};


// 統一的錯誤處理函數
function handleOllamaError(error, functionName) {
    console.error(`Error in ${functionName}:`, error.response ? error.response.data : error.message);
    let errorMessage = `與 AI (${functionName}) 通訊時發生錯誤。`;

    if (error.code === 'ECONNABORTED') {
        errorMessage = '連接 AI 超時，請稍後再試。';
    } else if (error.response) {
        // Ollama 返回了錯誤訊息
        if (error.response.data && error.response.data.error) {
            if (error.response.data.error.includes("model not found")) {
                 // 嘗試從 axios config data 中獲取模型名稱
                 let modelName = 'specified';
                 try {
                     if (error.config?.data) {
                         modelName = JSON.parse(error.config.data).model;
                     }
                 } catch (e) { /* ignore parsing error */ }
                 errorMessage = `AI 模型 '${modelName}' 未找到。請確認 Ollama 已下載該模型 (ollama pull ${modelName})。`;
            } else {
                errorMessage = `Ollama API 錯誤: ${error.response.data.error}`;
            }
        } else {
            errorMessage = `AI 伺服器錯誤 (狀態碼: ${error.response.status})。`;
        }
    } else if (error.request) {
        // 請求已發出，但沒有收到回應
        errorMessage = '無法連接到 AI 服務。請檢查 Ollama 是否正在運行以及網路連接是否正常。';
    } else {
        // 發生了其他錯誤
        errorMessage = `發生未知錯誤: ${error.message}`;
    }
    // 重要：拋出錯誤，以便調用方 (例如 TrainingRoom component) 可以捕獲並處理
    throw new Error(errorMessage);
}