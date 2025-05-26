// src/components/TrainingRoom/TrainingRoom.js
import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Alert, Button, Image } from 'react-bootstrap';
import ChatDisplay from './ChatDisplay';
import MessageInput from './MessageInput';
import { sendMessageToOllama, getFeedbackFromBackend } from '../../services/ollamaService';
import { USER_SOCIAL_SKILL_CHART_CONFIG } from '../FeedbackWall/FeedbackWall';
import '../../styles/TrainingRoom.css';

const TRAINING_ROOM_HISTORY_BASE_PREFIX = 'wingchat_training_history_v3.1_';
const FEEDBACK_STORAGE_KEY = 'wingchat_feedback';

// 【移除】 wrapText 輔助函數，使用者訊息將不再自動換行

function TrainingRoom({ selectedCharacter }) {
  const [messages, setMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGettingFeedback, setIsGettingFeedback] = useState(false);
  const [error, setError] = useState(null);
  const [isInitialLoadDone, setIsInitialLoadDone] = useState(false);

  const getMessageHistoryStorageKey = useCallback(() => {
    if (!selectedCharacter || !selectedCharacter.id) return null;
    return `${TRAINING_ROOM_HISTORY_BASE_PREFIX}${selectedCharacter.id}`;
  }, [selectedCharacter]);

  useEffect(() => {
    if (!selectedCharacter || !selectedCharacter.id) {
      setMessages([]);
      setCurrentMessage('');
      setError(null);
      setIsInitialLoadDone(true);
      return;
    }
    setIsInitialLoadDone(false);
    const messageKey = getMessageHistoryStorageKey();
    if (messageKey) {
      const savedMessages = localStorage.getItem(messageKey);
      if (savedMessages) {
        try {
          const parsed = JSON.parse(savedMessages);
          setMessages(Array.isArray(parsed) ? parsed : []);
        } catch (e) {
          console.error("TrainingRoom: Failed to parse messages for key:", messageKey, e);
          setMessages([]);
        }
      } else {
        setMessages([]);
      }
    } else {
      setMessages([]);
    }
    setCurrentMessage('');
    setError(null);
    setIsInitialLoadDone(true);
  }, [selectedCharacter, getMessageHistoryStorageKey]);

  useEffect(() => {
    if (!selectedCharacter || !selectedCharacter.id || !isInitialLoadDone) {
      return;
    }
    const messageKey = getMessageHistoryStorageKey();
    if (messageKey) {
      if (messages.length > 0) {
        localStorage.setItem(messageKey, JSON.stringify(messages));
      } else {
        localStorage.removeItem(messageKey);
      }
    }
  }, [messages, selectedCharacter, getMessageHistoryStorageKey, isInitialLoadDone]);

  const handleClearChat = () => {
    if (selectedCharacter && window.confirm(`確定要清除與 ${selectedCharacter.name} 的所有聊天記錄嗎？`)) {
        setMessages([]);
    } else if (!selectedCharacter) {
        alert("錯誤：未選擇角色。");
    }
  };

  const handleSendMessage = async () => {
    if (!currentMessage.trim()) { setError("請輸入訊息。"); return; }
    if (!selectedCharacter ) { setError("錯誤：未選擇角色。請返回角色館選擇。"); return; }
    if (isLoading || isGettingFeedback) return;

    // 【修改點6】 移除對 wrapText 的調用。使用者訊息不再自動換行。
    const newUserMessage = { id: `user-${Date.now()}`, sender: 'user', text: currentMessage }; 
    
    setMessages(prevMessages => [...prevMessages, newUserMessage]);
    setCurrentMessage('');
    setIsLoading(true);
    setError(null);

    try {
      const historyForOllama = [...messages, newUserMessage] // Important: include the new message for context
        .filter(msg => msg.sender === 'user' || msg.sender === 'ai')
        .map(msg => ({ role: msg.sender === 'user' ? 'user' : 'assistant', content: msg.text }));
      
      const placeholderGoal = "進行自然的對話練習"; 
      const aiResponseText = await sendMessageToOllama(placeholderGoal, historyForOllama, selectedCharacter, "character_play");

      if (aiResponseText && typeof aiResponseText === 'string') {
        const individualLines = aiResponseText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const newAiMessages = individualLines.map((line, index) => ({
            id: `ai-${Date.now()}-${index}`, sender: 'ai', text: line,
        }));
        setMessages(prev => [...prev, ...newAiMessages]);
      } else if (aiResponseText) {
        setMessages(prev => [...prev, { id: `ai-${Date.now()}-single`, sender: 'ai', text: String(aiResponseText) }]);
      } else {
        console.warn("TrainingRoom: AI response was empty or null.");
      }
    } catch (err) {
      console.error("Error in handleSendMessage (TrainingRoom):", err);
      const errorMsg = err.message || "與 AI 通訊時發生錯誤。";
      setError(errorMsg);
      setMessages(prev => [...prev, { id: `syserr-${Date.now()}`, sender: 'system', text: `🤖 抱歉，處理您的訊息時遇到問題：${errorMsg}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetFeedback = async () => {
      if (!selectedCharacter || messages.filter(m => m.sender === 'user').length === 0) {
          alert("請先選擇角色並進行至少一輪對話 (至少一條您的訊息)，才能請求回饋。");
          return;
      }
      if (isLoading || isGettingFeedback) return;

      setIsGettingFeedback(true);
      setError(null);
      const feedbackRequestMessage = { id: `system-fbreq-${Date.now()}`, sender: 'system', text: '⏳ 正在向 AI 請求對您的對話表現進行評估...' };
      setMessages(prev => [...prev, feedbackRequestMessage]);

      try {
          const historyForFeedback = messages
            .filter(msg => msg.sender === 'user' || msg.sender === 'ai')
            .map(msg => ({ role: msg.sender === 'user' ? 'user' : 'assistant', content: msg.text }));
          
          const placeholderGoalForFeedback = "對話練習";
          const feedbackDataFromBackend = await getFeedbackFromBackend(placeholderGoalForFeedback, historyForFeedback, selectedCharacter);
          
          if (!feedbackDataFromBackend || !feedbackDataFromBackend.userEvaluation) {
            throw new Error("從後端收到的回饋數據格式不正確或為空。");
          }
          const userEval = feedbackDataFromBackend.userEvaluation;

          let feedbackDisplayMessageText = `💡 **AI 對您的表現評估 (與 ${selectedCharacter.name} 的對話)**\n\n`;
          feedbackDisplayMessageText += `**整體總結:**\n${userEval.summary || "AI 未提供總結。"}\n\n`;
          feedbackDisplayMessageText += "**各項技能評分 (0-100):**\n";

          if (userEval.scores) {
              // 為了確保評分列表的每個項目都以 `*` 開始，可以再次明確構造它
              feedbackDisplayMessageText += `* 表達清晰度 (clarity): ${userEval.scores.clarity?.score || 'N/A'} (理由: ${userEval.scores.clarity?.justification || '無'})\n`;
              feedbackDisplayMessageText += `* 同理心展現 (empathy): ${userEval.scores.empathy?.score || 'N/A'} (理由: ${userEval.scores.empathy?.justification || '無'})\n`;
              feedbackDisplayMessageText += `* 自信程度 (confidence): ${userEval.scores.confidence?.score || 'N/A'} (理由: ${userEval.scores.confidence?.justification || '無'})\n`;
              feedbackDisplayMessageText += `* 言談適當性 (appropriateness): ${userEval.scores.appropriateness?.score || 'N/A'} (理由: ${userEval.scores.appropriateness?.justification || '無'})\n`;
              feedbackDisplayMessageText += `* 目標達成技巧 (goalAchievement): ${userEval.scores.goalAchievement?.score || 'N/A'} (理由: ${userEval.scores.goalAchievement?.justification || '無'})\n`;

          } else { 
            feedbackDisplayMessageText += "未能解析詳細評分。\n";
             USER_SOCIAL_SKILL_CHART_CONFIG.forEach(configItem => {
                feedbackDisplayMessageText += `- ${configItem.label}: N/A (理由: 未能解析)\n`;
            });
          }

          if (userEval.strengths && userEval.strengths.length > 0) {
              feedbackDisplayMessageText += "\n**您的優點:**\n";
              userEval.strengths.forEach(item => { feedbackDisplayMessageText += `- ${item}\n`; });
          } else {
              feedbackDisplayMessageText += "\n**您的優點:**\n- AI 未提供具體優點。\n";
          }

          if (userEval.improvements && userEval.improvements.length > 0) {
              feedbackDisplayMessageText += "\n**給您的改進建議:**\n";
              userEval.improvements.forEach(item => { feedbackDisplayMessageText += `- ${item}\n`; });
          } else {
              feedbackDisplayMessageText += "\n**給您的改進建議:**\n- AI 未提供具體建議。\n";
          }
          
          const feedbackSystemMessage = { id: `user-eval-${Date.now() + 1}`, sender: 'system', text: feedbackDisplayMessageText };
          const scoresForStorage = {};
          USER_SOCIAL_SKILL_CHART_CONFIG.forEach(configItem => {
              scoresForStorage[configItem.key] = (userEval.scores && userEval.scores[configItem.key] && typeof userEval.scores[configItem.key].score === 'number') 
                                                  ? userEval.scores[configItem.key].score 
                                                  : null;
          });
          const userMessagesSummary = messages.filter(m => m.sender === 'user').map(m=>m.text).join(' ').substring(0,100);
          const newFeedbackEntry = {
              id: `feedback-${Date.now()}`, timestamp: Date.now(), 
              goal: placeholderGoalForFeedback, 
              characterId: selectedCharacter.id, characterName: selectedCharacter.name,
              scores: scoresForStorage,
              summary: userEval.summary || `與 ${selectedCharacter.name} 進行的對話練習。用戶發言摘要: ${userMessagesSummary}...`,
              rawUserEvaluationFeedback: feedbackDataFromBackend.rawFeedback,
              userEvaluationDetails: userEval 
          };
          const existingFeedback = JSON.parse(localStorage.getItem(FEEDBACK_STORAGE_KEY) || '[]');
          localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify([...existingFeedback, newFeedbackEntry]));
          setMessages(prev => [ ...prev.filter(msg => msg.id !== feedbackRequestMessage.id), feedbackSystemMessage ]);
      } catch (err) {
          console.error("Error in handleGetFeedback (TrainingRoom - User Eval):", err);
          const errorMsg = err.message || "無法獲取或處理對您的表現評估。";
          setError(errorMsg);
          setMessages(prev => [ ...prev.filter(msg => msg.id !== feedbackRequestMessage.id), { id: `syserr-eval-${Date.now()}`, sender: 'system', text: `🤖 抱歉，評估您的表現時遇到問題：${errorMsg}` }]);
      } finally {
          setIsGettingFeedback(false);
      }
  };
  
  if (!selectedCharacter) {
    return (
      <Container className="text-center mt-5">
        <Alert variant="warning">請先從「角色館」選擇一位角色開始訓練。</Alert>
      </Container>
    );
  }

  return (
    <Container fluid className="training-room-container vh-100 p-0"> {/* 移除內邊距 */}
      <Row className="goal-input-row m-0"> {/* Instagram 風格頂部 */}
        <Col className="d-flex align-items-center justify-content-between p-2">
            <div className="d-flex align-items-center text-truncate">
                {selectedCharacter.imageUrl && (
                    <Image 
                        src={selectedCharacter.imageUrl} 
                        roundedCircle 
                        style={{width: '32px', height: '32px', objectFit: 'cover', marginRight: '12px', border: 'none', flexShrink: 0}} 
                        alt={selectedCharacter.name}
                        onError={(e) => { e.target.style.display = 'none'; }}
                    />
                )}
                <span className="text-dark text-truncate fw-bold" title={`與 ${selectedCharacter.name} 訓練中`}>
                    {selectedCharacter.name}
                </span>
            </div>
            <Button 
                variant="link" 
                size="sm" 
                onClick={handleClearChat}
                disabled={messages.length === 0 || isLoading || isGettingFeedback}
                title="清除聊天記錄"
                style={{flexShrink: 0, color: '#262626'}} 
            >
                <i className="bi bi-trash3"></i>
            </Button>
        </Col>
        {error && ( 
            <Col xs={12} className="mt-1"> 
                <Alert variant="danger" onClose={() => setError(null)} dismissible className="py-1 px-2 small mb-0"> 
                    {error} 
                </Alert> 
            </Col> 
        )}
      </Row>
      <Row className="chat-display-row m-0" style={{
        height: 'calc(100vh - 130px)', 
        overflow: 'hidden',
        position: 'relative' // 確保定位上下文正確
      }}> {/* Instagram 風格聊天區域 */}
        <Col className="p-3 h-100"><ChatDisplay messages={messages} isLoading={isLoading && !isGettingFeedback} aiAvatarUrl={selectedCharacter.imageUrl} /></Col>
      </Row>
      <Row className="message-input-row m-0">
        <Col className="p-2">
          <MessageInput
            currentMessage={currentMessage} 
            onMessageChange={setCurrentMessage}
            onSendMessage={handleSendMessage} 
            onGetFeedback={handleGetFeedback}
            isLoading={isLoading} 
            isGettingFeedback={isGettingFeedback}
            disabled={!selectedCharacter}
            showFeedbackButton={true}
            />
        </Col>
      </Row>
    </Container>
  );
}
export default TrainingRoom;