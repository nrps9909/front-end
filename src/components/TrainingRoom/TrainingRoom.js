import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Form, InputGroup, Container, Row, Col, Spinner, Alert, Button } from 'react-bootstrap';
import ChatDisplay from './ChatDisplay';
import MessageInput from './MessageInput';
import { sendMessageToOllama, getFeedbackFromOllama } from '../../services/ollamaService'; // 引入 API 服務
import '../../styles/TrainingRoom.css'; // 引入聊天室樣式

// 本地儲存聊天記錄的 Key 前綴
const CHAT_HISTORY_PREFIX = 'wingchat_history_';
// 本地儲存回饋的 Key
const FEEDBACK_STORAGE_KEY = 'wingchat_feedback';


function TrainingRoom({ selectedCharacter }) {
  const [goal, setGoal] = useState('');
  const [messages, setMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGettingFeedback, setIsGettingFeedback] = useState(false);
  const [error, setError] = useState(null);
  const currentGoalRef = useRef(goal);

  // 產生用於儲存的 key
  const getStorageKey = useCallback(() => {
      if (!selectedCharacter || !goal.trim()) return null;
      const goalKey = goal.trim().substring(0, 50).replace(/[^a-zA-Z0-9-_]/g, '_'); // 允許底線和連字號
      return `${CHAT_HISTORY_PREFIX}${selectedCharacter.id}_${goalKey}`;
  }, [selectedCharacter, goal]);

  // 加載聊天記錄
  useEffect(() => {
    currentGoalRef.current = goal;
    const storageKey = getStorageKey();
    if (storageKey) {
      const savedHistory = localStorage.getItem(storageKey);
      if (savedHistory) {
        try {
          setMessages(JSON.parse(savedHistory));
        } catch (e) {
          console.error("Failed to parse chat history", e);
          setMessages([]);
        }
      } else {
        setMessages([]);
      }
    } else if (selectedCharacter) {
        setMessages([]);
    }
     setError(null);
  }, [selectedCharacter, goal, getStorageKey]);

   // 保存聊天記錄
   useEffect(() => {
     const storageKey = getStorageKey();
     if (storageKey && messages.length > 0) {
       localStorage.setItem(storageKey, JSON.stringify(messages));
     }
     else if (storageKey && messages.length === 0) {
         localStorage.removeItem(storageKey);
     }
   }, [messages, getStorageKey]);


  // 清除當前目標的聊天記錄
  const handleClearChat = () => {
      if (window.confirm(`確定要清除與 ${selectedCharacter?.name} 關於目標「${goal}」的所有聊天記錄嗎？`)) {
          setMessages([]);
          const storageKey = getStorageKey();
          if (storageKey) {
              localStorage.removeItem(storageKey);
          }
      }
  }

  // 發送訊息處理
  const handleSendMessage = async () => {
    if (!currentMessage.trim() || !selectedCharacter) return;
    if (!goal.trim()) {
      setError("請先設定本次聊天的目標！");
      return;
    }
    if (isLoading || isGettingFeedback) return;

    const newUserMessage = {
      id: Date.now(),
      sender: 'user',
      text: currentMessage,
    };

    const currentInput = currentMessage;
    // 立即更新 UI
    setMessages(prevMessages => [...prevMessages, newUserMessage]);
    setCurrentMessage('');
    setIsLoading(true);
    setError(null);

    try {
      const historyForOllama = messages.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
      }));
      // 使用最新的 user message (currentInput) 構建傳遞給 API 的歷史
      const requestHistory = [...historyForOllama, { role: 'user', content: currentInput }];


      const aiResponseText = await sendMessageToOllama(
        goal,
        requestHistory, // 使用包含最新消息的歷史
        selectedCharacter,
        "llama3.2:latest" // 確認使用新模型名稱
      );

      const newAiMessage = {
        id: Date.now() + 1,
        sender: 'ai',
        text: aiResponseText,
      };
      // 注意：這裡的 setMessages 是基於「請求發起時」的 messages 狀態來添加 AI 回覆
      // 為了確保 user message 肯定在 AI message 之前，我們直接添加在 newUserMessage 之後
      setMessages(prevMessages => [...prevMessages, newAiMessage]);

    } catch (err) {
      console.error("Error contacting Ollama:", err);
      const errorMsg = err.message || "與 AI 通訊時發生錯誤。";
      setError(errorMsg);
      const errorAiMessage = {
        id: Date.now() + 1,
        sender: 'ai',
        text: `🤖 抱歉，處理時遇到問題：${errorMsg}`,
      };
      // 同樣，添加在最新的 user message 之後
       setMessages(prevMessages => [...prevMessages, errorAiMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // --- 回饋解析函數 (修正後) ---
  const parseFeedback = (feedbackText) => {
      let summary = "無法解析回饋摘要。";
      let scores = {
          clarity: null, empathy: null, confidence: null, appropriateness: null, goalAchievement: null
      };
      // *** 在 try 之前宣告變數 ***
      let summaryMatch = null;
      let summaryOnlyMatch = null; // <--- 在這裡宣告
      let scoresTextMatch = null;

      try {
          // 解析摘要
          summaryMatch = feedbackText.match(/\[Feedback Summary\]\s*([\s\S]*?)\s*\[Scores\]/);
          if (summaryMatch && summaryMatch[1]) {
              summary = summaryMatch[1].trim();
          } else {
              // 嘗試備用模式，如果沒有 [Scores] 標籤
              summaryOnlyMatch = feedbackText.match(/\[Feedback Summary\]\s*([\s\S]*)/); // 賦值給外部宣告的變數
              if (summaryOnlyMatch && summaryOnlyMatch[1]) {
                summary = summaryOnlyMatch[1].trim();
                console.warn("Feedback parsing: Only found summary, scores section missing or malformed.");
              } else {
                console.warn("Feedback parsing: Could not find [Feedback Summary] section.");
                summary = feedbackText; // 將整個文本視為摘要
              }
          }

          // 解析分數
          scoresTextMatch = feedbackText.match(/\[Scores\]\s*([\s\S]*)/);
          if (scoresTextMatch && scoresTextMatch[1]) {
              const scoreLines = scoresTextMatch[1].trim().split('\n');
              scoreLines.forEach(line => {
                  const parts = line.split(':');
                  if (parts.length === 2) {
                      // 將 key 轉換為標準格式 (小寫，移除空格，符合 scores 物件的 key)
                      let key = parts[0].trim().toLowerCase().replace(/\s+/g, '');
                      if (key === 'goalachievement') key = 'goalAchievement'; // 處理大小寫差異

                      const value = parts[1].trim();

                      // 檢查這個 key 是否是我們預期的分數鍵之一
                      if (Object.prototype.hasOwnProperty.call(scores, key)) {
                           if (value.toLowerCase() === 'n/a') {
                              scores[key] = null; // N/A 視為 null
                           } else {
                              const score = parseInt(value, 10);
                              if (!isNaN(score)) {
                                  // 將分數限制在 0-100 範圍內
                                  scores[key] = Math.max(0, Math.min(100, score));
                              } else {
                                  console.warn(`Feedback parsing: Invalid score value "${value}" for key "${key}"`);
                                  scores[key] = null; // 無效數字也視為 null
                              }
                           }
                      } else {
                          console.warn(`Feedback parsing: Unexpected score key "${key}" found.`);
                      }
                  }
              });
          // *** 現在可以安全地檢查 summaryOnlyMatch ***
          } else if (!summaryOnlyMatch && summaryMatch === null){ // 只有在兩種 summary 模式都沒匹配到時才報警
              console.warn("Feedback parsing: Could not find [Scores] section, and possibly no [Feedback Summary] either.");
          }
      } catch (e) {
          console.error("Error parsing feedback text:", e);
          // 出錯時返回原始文本作為摘要，分數為空
          summary = feedbackText;
          // 重置 scores 以確保一致性
           scores = { clarity: null, empathy: null, confidence: null, appropriateness: null, goalAchievement: null };
      }

      console.log("Parsed Feedback:", { summary, scores });
      return { summary, scores };
  }
  // --- 結束回饋解析函數 ---


  // 獲取回饋處理
  const handleGetFeedback = async () => {
      if (!selectedCharacter || !goal.trim() || messages.filter(m => m.sender !== 'system').length === 0) {
          alert("請先設定目標、選擇角色並進行至少一輪對話，才能請求回饋。");
          return;
      }
      if (isLoading || isGettingFeedback) return;

      setIsGettingFeedback(true);
      setError(null);
      const feedbackRequestMessage = {
          id: Date.now(),
          sender: 'system',
          text: '⏳ 正在向 AI 請求對話回饋...'
      };
      setMessages(prevMessages => [...prevMessages, feedbackRequestMessage]);


      try {
          const historyForFeedback = messages
            .filter(msg => msg.sender !== 'system')
            .map(msg => ({
                role: msg.sender === 'user' ? 'user' : 'assistant',
                content: msg.text
            }));

          const feedbackRawText = await getFeedbackFromOllama(
              goal,
              historyForFeedback,
              selectedCharacter,
              "llama3.2:latest" // 確認使用新模型名稱
          );

          // 解析並儲存回饋
          const { summary, scores } = parseFeedback(feedbackRawText);

          const feedbackMessage = {
              id: Date.now() + 1,
              sender: 'ai',
              text: `💡 **本次對話回饋 (${goal})**\n\n**摘要:**\n${summary}\n\n**評分 (0-100):**\n- 清晰度: ${scores.clarity ?? 'N/A'}\n- 同理心: ${scores.empathy ?? 'N/A'}\n- 自信: ${scores.confidence ?? 'N/A'}\n- 適當性: ${scores.appropriateness ?? 'N/A'}\n- 目標達成: ${scores.goalAchievement ?? 'N/A'}`
          };

          // 儲存到 localStorage 供 FeedbackWall 使用
          const newFeedbackEntry = {
              timestamp: Date.now(),
              goal: goal,
              characterId: selectedCharacter.id,
              characterName: selectedCharacter.name,
              scores: scores,
              summary: summary,
              rawFeedback: feedbackRawText // (可選) 儲存原始文本供調試
          };
          const existingFeedback = JSON.parse(localStorage.getItem(FEEDBACK_STORAGE_KEY) || '[]');
          localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify([...existingFeedback, newFeedbackEntry]));

          // 移除"正在請求"的訊息，並加入解析後的回饋訊息
          setMessages(prevMessages => [
              ...prevMessages.filter(msg => msg.id !== feedbackRequestMessage.id),
              feedbackMessage
          ]);


      } catch (err) {
          console.error("Error getting or parsing feedback from Ollama:", err);
          const errorMsg = err.message || "無法獲取或處理 AI 回饋。";
          setError(errorMsg);
          const errorFeedbackMessage = {
            id: Date.now() + 1,
            sender: 'ai',
            text: `🤖 抱歉，獲取回饋時遇到問題：${errorMsg}`
          };
           setMessages(prevMessages => [
                ...prevMessages.filter(msg => msg.id !== feedbackRequestMessage.id),
                errorFeedbackMessage
           ]);
      } finally {
          setIsGettingFeedback(false);
      }
  };


  return (
    <Container fluid className="training-room-container vh-100">
      {/* --- 目標輸入與角色資訊 --- */}
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
              請先至 <a href="#" onClick={(e) => { e.preventDefault(); alert('請點擊上方導覽列的「角色館」'); }}>角色館</a> 選擇或新增角色
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

      {/* --- 聊天顯示區域 --- */}
      <Row className="chat-display-row">
        <Col>
          <ChatDisplay messages={messages} isLoading={isLoading /* Loading animation only for AI response, not feedback */} />
        </Col>
      </Row>

      {/* --- 訊息輸入區域 --- */}
      <Row className="message-input-row sticky-bottom bg-light p-3">
        <Col>
          <MessageInput
            currentMessage={currentMessage}
            onMessageChange={setCurrentMessage}
            onSendMessage={handleSendMessage}
            onGetFeedback={handleGetFeedback}
            isLoading={isLoading}
            isGettingFeedback={isGettingFeedback} // 傳遞回饋讀取狀態
            disabled={!selectedCharacter || !goal.trim()}
          />
        </Col>
      </Row>
    </Container>
  );
}

export default TrainingRoom;