import React, { useState, useEffect, useRef, useCallback } from 'react';
// Spinner 可能仍由子組件 MessageInput 或 ChatDisplay 使用，所以保持導入 react-bootstrap 的 Spinner
import { Form, InputGroup, Container, Row, Col, Spinner, Alert, Button } from 'react-bootstrap';
import ChatDisplay from './ChatDisplay';
import MessageInput from './MessageInput';
import { sendMessageToOllama, getFeedbackFromOllama } from '../../services/ollamaService';
import '../../styles/TrainingRoom.css';

const CHAT_HISTORY_PREFIX = 'wingchat_history_';
const FEEDBACK_STORAGE_KEY = 'wingchat_feedback';

// *** CUSTOM_MODEL_NAME 已移除，因為模型名稱由後端決定 ***
// const CUSTOM_MODEL_NAME = 'my-custom-llama3'; // <--- 移除或註釋掉這行

// *** 為 getFeedbackFromOllama 定義一個模型名稱 (如果它繼續直接調用 Ollama) ***
// *** 確保這個模型是你 Ollama 中用於回饋的模型 ***
const FEEDBACK_OLLAMA_MODEL_NAME = 'my-custom-llama3'; // 或者其他你希望用於回饋的模型

function TrainingRoom({ selectedCharacter }) {
  const [goal, setGoal] = useState('');
  const [messages, setMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGettingFeedback, setIsGettingFeedback] = useState(false);
  const [error, setError] = useState(null);
  const currentGoalRef = useRef(goal); // currentGoalRef 未在代碼中使用，可以考慮移除

  const getStorageKey = useCallback(() => {
      if (!selectedCharacter || !goal.trim()) return null;
      const goalKey = goal.trim().substring(0, 50).replace(/[^a-zA-Z0-9-_]/g, '_');
      return `${CHAT_HISTORY_PREFIX}${selectedCharacter.id}_${goalKey}`;
  }, [selectedCharacter, goal]);

  useEffect(() => {
    // currentGoalRef.current = goal; // 如果 currentGoalRef 不用於其他地方，這行可以移除
    const storageKey = getStorageKey();
    if (storageKey) {
      const savedHistory = localStorage.getItem(storageKey);
      if (savedHistory) {
        try { setMessages(JSON.parse(savedHistory)); }
        catch (e) { console.error("Failed to parse chat history", e); setMessages([]); }
      } else { setMessages([]); }
    } else if (selectedCharacter) { setMessages([]); }
    setError(null);
  }, [selectedCharacter, goal, getStorageKey]);

   useEffect(() => {
     const storageKey = getStorageKey();
     if (storageKey && messages.length > 0) {
       localStorage.setItem(storageKey, JSON.stringify(messages));
     } else if (storageKey && messages.length === 0) {
       localStorage.removeItem(storageKey);
     }
   }, [messages, getStorageKey]);

  const handleClearChat = () => {
      if (window.confirm(`確定要清除與 ${selectedCharacter?.name} 關於目標「${goal}」的所有聊天記錄嗎？`)) {
          setMessages([]);
          const storageKey = getStorageKey();
          if (storageKey) { localStorage.removeItem(storageKey); }
      }
  }

  const handleSendMessage = async () => {
    if (!currentMessage.trim() || !selectedCharacter) return;
    if (!goal.trim()) { setError("請先設定本次聊天的目標！"); return; }
    if (isLoading || isGettingFeedback) return;

    const newUserMessage = { id: Date.now(), sender: 'user', text: currentMessage };
    const currentInput = currentMessage;
    setMessages(prevMessages => [...prevMessages, newUserMessage]);
    setCurrentMessage('');
    setIsLoading(true);
    setError(null);

    try {
      const historyForOllama = messages.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
      }));
      const requestHistory = [...historyForOllama, { role: 'user', content: currentInput }];

      // *** 調用 sendMessageToOllama 時不再傳遞模型名稱 ***
      const aiResponseText = await sendMessageToOllama(
        goal,
        requestHistory,
        selectedCharacter
        // CUSTOM_MODEL_NAME // <--- 已移除
      );

      const newAiMessage = { id: Date.now() + 1, sender: 'ai', text: aiResponseText };
      setMessages(prevMessages => [...prevMessages, newAiMessage]);

    } catch (err) {
      console.error("Error contacting AI service:", err); // 修改日誌訊息
      const errorMsg = err.message || "與 AI 通訊時發生錯誤。";
      setError(errorMsg);
      const errorAiMessage = { id: Date.now() + 1, sender: 'ai', text: `🤖 抱歉，處理時遇到問題：${errorMsg}` };
      setMessages(prevMessages => [...prevMessages, errorAiMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // 回饋解析函數 (保持不變)
  const parseFeedback = (feedbackText) => {
      let summary = "無法解析回饋摘要。";
      let scores = { clarity: null, empathy: null, confidence: null, appropriateness: null, goalAchievement: null };
      let summaryMatch = null;
      let summaryOnlyMatch = null;
      let scoresTextMatch = null;
      try {
          summaryMatch = feedbackText.match(/\[Feedback Summary\]\s*([\s\S]*?)\s*\[Scores\]/);
          if (summaryMatch && summaryMatch[1]) {
              summary = summaryMatch[1].trim();
          } else {
              summaryOnlyMatch = feedbackText.match(/\[Feedback Summary\]\s*([\s\S]*)/);
              if (summaryOnlyMatch && summaryOnlyMatch[1]) {
                summary = summaryOnlyMatch[1].trim();
                console.warn("Feedback parsing: Only found summary, scores section missing or malformed.");
              } else {
                console.warn("Feedback parsing: Could not find [Feedback Summary] section.");
                summary = feedbackText;
              }
          }
          scoresTextMatch = feedbackText.match(/\[Scores\]\s*([\s\S]*)/);
          if (scoresTextMatch && scoresTextMatch[1]) {
              const scoreLines = scoresTextMatch[1].trim().split('\n');
              scoreLines.forEach(line => {
                  const parts = line.split(':');
                  if (parts.length === 2) {
                      let key = parts[0].trim().toLowerCase().replace(/\s+/g, '');
                      if (key === 'goalachievement') key = 'goalAchievement';
                      const value = parts[1].trim();
                      if (Object.prototype.hasOwnProperty.call(scores, key)) {
                           if (value.toLowerCase() === 'n/a') {
                              scores[key] = null;
                           } else {
                              const score = parseInt(value, 10);
                              if (!isNaN(score)) {
                                  scores[key] = Math.max(0, Math.min(100, score));
                              } else {
                                  console.warn(`Feedback parsing: Invalid score value "${value}" for key "${key}"`);
                                  scores[key] = null;
                              }
                           }
                      } else {
                          console.warn(`Feedback parsing: Unexpected score key "${key}" found.`);
                      }
                  }
              });
          } else if (!summaryOnlyMatch && summaryMatch === null){
              console.warn("Feedback parsing: Could not find [Scores] section, and possibly no [Feedback Summary] either.");
          }
      } catch (e) {
          console.error("Error parsing feedback text:", e);
          summary = feedbackText;
          scores = { clarity: null, empathy: null, confidence: null, appropriateness: null, goalAchievement: null };
      }
      console.log("Parsed Feedback:", { summary, scores });
      return { summary, scores };
  }

  const handleGetFeedback = async () => {
      if (!selectedCharacter || !goal.trim() || messages.filter(m => m.sender !== 'system').length === 0) {
          alert("請先設定目標、選擇角色並進行至少一輪對話，才能請求回饋。");
          return;
      }
      if (isLoading || isGettingFeedback) return;

      setIsGettingFeedback(true);
      setError(null);
      const feedbackRequestMessage = { id: Date.now(), sender: 'system', text: '⏳ 正在向 AI 請求對話回饋...' };
      setMessages(prevMessages => [...prevMessages, feedbackRequestMessage]);

      try {
          const historyForFeedback = messages
            .filter(msg => msg.sender !== 'system')
            .map(msg => ({ role: msg.sender === 'user' ? 'user' : 'assistant', content: msg.text }));

          const feedbackRawText = await getFeedbackFromOllama(
              goal,
              historyForFeedback,
              selectedCharacter,
              FEEDBACK_OLLAMA_MODEL_NAME // 使用為回饋定義的模型名稱
          );

          const { summary, scores } = parseFeedback(feedbackRawText);
          const feedbackMessage = {
              id: Date.now() + 1,
              sender: 'ai',
              text: `💡 **本次對話回饋 (${goal})**\n\n**摘要:**\n${summary}\n\n**評分 (0-100):**\n- 清晰度: ${scores.clarity ?? 'N/A'}\n- 同理心: ${scores.empathy ?? 'N/A'}\n- 自信: ${scores.confidence ?? 'N/A'}\n- 適當性: ${scores.appropriateness ?? 'N/A'}\n- 目標達成: ${scores.goalAchievement ?? 'N/A'}`
          };
          const newFeedbackEntry = {
              timestamp: Date.now(),
              goal: goal,
              characterId: selectedCharacter.id,
              characterName: selectedCharacter.name,
              scores: scores,
              summary: summary,
              rawFeedback: feedbackRawText
          };
          const existingFeedback = JSON.parse(localStorage.getItem(FEEDBACK_STORAGE_KEY) || '[]');
          localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify([...existingFeedback, newFeedbackEntry]));
          setMessages(prevMessages => [
              ...prevMessages.filter(msg => msg.id !== feedbackRequestMessage.id),
              feedbackMessage
          ]);
      } catch (err) {
          console.error("Error getting or parsing feedback from Ollama:", err);
          const errorMsg = err.message || "無法獲取或處理 AI 回饋。";
          setError(errorMsg);
          const errorFeedbackMessage = { id: Date.now() + 1, sender: 'ai', text: `🤖 抱歉，獲取回饋時遇到問題：${errorMsg}` };
           setMessages(prevMessages => [
                ...prevMessages.filter(msg => msg.id !== feedbackRequestMessage.id),
                errorFeedbackMessage
           ]);
      } finally {
          setIsGettingFeedback(false);
      }
  };

  // JSX 保持不變，但注意 Spinner 仍然是從 react-bootstrap 導入的，如果 TrainingRoom.js 頂層的 import 移除了 Spinner，
  // 而子組件 ChatDisplay 或 MessageInput 依賴它，它們需要自己導入 Spinner。
  // 從你的代碼看，TrainingRoom 本身沒有直接用 <Spinner />，是用於 Button 內，所以保持 Spinner 導入是OK的。
  return (
    <Container fluid className="training-room-container vh-100">
      {/* 目標輸入與角色資訊 */}
      <Row className="goal-input-row bg-light p-2 mb-2 sticky-top shadow-sm">
        <Col md={7}>
          <InputGroup>
            <InputGroup.Text>🎯</InputGroup.Text>
            <Form.Control
              type="text"
              placeholder={selectedCharacter ? "輸入本次社交訓練目標..." : "請先選擇角色..."}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              disabled={!selectedCharacter || isLoading || isGettingFeedback}
              aria-label="聊天目標"
            />
          </InputGroup>
        </Col>
        <Col md={5} className="d-flex align-items-center justify-content-md-end mt-2 mt-md-0">
          {selectedCharacter ? (
            <div className="d-flex align-items-center">
                <span className="text-muted me-3 text-truncate" title={`與 ${selectedCharacter.name} 訓練中`}>
                    與 <strong>{selectedCharacter.name}</strong> 訓練中
                 </span>
                <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={handleClearChat}
                    disabled={messages.length === 0 || isLoading || isGettingFeedback}
                    title={`清除關於目標 "${goal}" 的聊天記錄`}
                >
                    <i className="bi bi-trash3 me-1"></i> 清除記錄
                </Button>
            </div>
          ) : (
            <Alert variant="warning" className="p-1 mb-0 small w-100 text-center">
              請先至{' '}
              <button /* 使用之前建議的 button 樣式 */
                type="button"
                className="btn btn-link p-0 m-0 align-baseline"
                onClick={() => alert('請點擊上方導覽列的「角色館」')}
                style={{ fontSize: 'inherit', textDecoration: 'underline', color: 'inherit', verticalAlign: 'baseline' }}
              >
                角色館
              </button>
              {' '}選擇或新增角色
            </Alert>
          )}
        </Col>
        {error && (
            <Col xs={12} className="mt-2">
                <Alert variant="danger" onClose={() => setError(null)} dismissible className="py-1 px-2 small mb-0">
                    {error}
                </Alert>
            </Col>
        )}
      </Row>

      {/* 聊天顯示區域 */}
      <Row className="chat-display-row">
        <Col>
          {/* isLoading 傳遞給 ChatDisplay，以便它能顯示 "AI 正在思考..." */}
          <ChatDisplay messages={messages} isLoading={isLoading && !isGettingFeedback /* 只在聊天時顯示 AI 思考，回饋時不顯示 */} />
        </Col>
      </Row>

      {/* 訊息輸入區域 */}
      <Row className="message-input-row sticky-bottom bg-light p-3">
        <Col>
          <MessageInput
            currentMessage={currentMessage}
            onMessageChange={setCurrentMessage}
            onSendMessage={handleSendMessage}
            onGetFeedback={handleGetFeedback}
            isLoading={isLoading}
            isGettingFeedback={isGettingFeedback}
            disabled={!selectedCharacter || !goal.trim()}
          />
        </Col>
      </Row>
    </Container>
  );
}

export default TrainingRoom;