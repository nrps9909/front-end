import axios from 'axios';

const PYTHON_API_BASE_URL = process.env.REACT_APP_PYTHON_API_URL || 'http://localhost:5001';

// Added 'mode' parameter: "assistant" or "character_play"
export const sendMessageToOllama = async (goal, messages, character, mode = "character_play") => {
  const apiUrl = `${PYTHON_API_BASE_URL}/api/chat_py`;
  const payload = { goal, character, messages, mode }; // Add mode to payload
  console.log(`Sending message to Python backend (/api/chat_py) with mode: ${mode}:`, payload);

  try {
    const response = await axios.post(apiUrl, payload, { timeout: 70000 });
    console.log("Python backend response for chat:", response.data);
    if (response.data && response.data.message && typeof response.data.message.content === 'string') {
      return response.data.message.content;
    } else if (response.data && response.data.error) {
      throw new Error(`AI 服務錯誤: ${response.data.error}`);
    } else {
      throw new Error('從 Python AI 服務收到的回應結構無效 (chat)');
    }
  } catch (error) {
    handlePythonApiError(error, `sendMessageToOllama (mode: ${mode})`);
  }
};

// This service now expects the backend to return an evaluation of THE USER's performance
export const getFeedbackFromBackend = async (goal, messages, character) => {
  const apiUrl = `${PYTHON_API_BASE_URL}/api/feedback`;
  const payload = { goal, messages, character }; // messages here are the user-AI character chat
  console.log("Sending request to Python backend for USER feedback (/api/feedback):", payload);

  try {
    const response = await axios.post(apiUrl, payload, { timeout: 90000 });
    console.log("Python backend response for USER feedback:", response.data);
    // Backend should now return 'userEvaluation' field
    if (response.data && response.data.userEvaluation) {
      return {
          userEvaluation: response.data.userEvaluation, // Evaluation of the USER
          rawFeedback: response.data.raw_feedback,
          modelUsed: response.data.model
      };
    } else if (response.data && response.data.error) {
      throw new Error(`AI 服務錯誤 (使用者回饋): ${response.data.error}`);
    } else {
      throw new Error('從 Python AI 服務收到的回應結構無效 (使用者回饋)');
    }
  } catch (error) {
    handlePythonApiError(error, 'getFeedbackFromBackend (user eval)');
  }
};

function handlePythonApiError(error, functionName) {
    console.error(`Error in ${functionName} (calling Python backend):`, error.response ? error.response.data : error.message, error.code);
    let errorMessage = `與 AI 服務 (${functionName}) 通訊時發生錯誤。`;
    if (error.code === 'ECONNABORTED') {
        errorMessage = '連接 AI 服務超時，請稍後再試。';
    } else if (error.response && error.response.data && error.response.data.error) {
        errorMessage = `AI 服務錯誤: ${error.response.data.error}`;
        if (error.response.data.model) errorMessage += ` (模型: ${error.response.data.model})`;
    } else if (error.response) {
        errorMessage = `AI 服務錯誤 (狀態碼: ${error.response.status})。`;
    } else if (error.request) {
        errorMessage = '無法連接到 AI 服務。請檢查後端服務是否正在運行以及網路連接是否正常。';
    } else {
        errorMessage = error.message || '發生未知錯誤。';
    }
    // To ensure an Error object is thrown, which can be caught by typical error handling
    if (errorMessage instanceof Error) throw errorMessage;
    else throw new Error(errorMessage);
}