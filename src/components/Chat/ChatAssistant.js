// src/components/Chat/ChatAssistant.js
import React, { useState, useEffect, useCallback } from 'react';
import { Form, InputGroup, Container, Row, Col, Spinner, Alert, Button, Card, Image } from 'react-bootstrap';
import { sendMessageToOllama } from '../../services/ollamaService';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

marked.setOptions({
  gfm: true,
  breaks: true,
});

const ASSISTANT_HISTORY_BASE_PREFIX = 'wingchat_assistant_history_v3.1_';
const ASSISTANT_GOAL_BASE_PREFIX = 'wingchat_assistant_goal_v2.1_';

function ChatAssistant({ interactingWithCharacter }) {
  const [goal, setGoal] = useState('');
  const [partnerMessage, setPartnerMessage] = useState('');
  const [suggestedReply, setSuggestedReply] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [isInitialGoalLoadDone, setIsInitialGoalLoadDone] = useState(false);
  const [isInitialHistoryLoadDone, setIsInitialHistoryLoadDone] = useState(false);

  const characterId = interactingWithCharacter ? interactingWithCharacter.id : 'generic';

  const getCurrentGoalStorageKey = useCallback(() => {
      return `${ASSISTANT_GOAL_BASE_PREFIX}${characterId}`;
  }, [characterId]);

  const getConversationHistoryStorageKey = useCallback(() => {
    if (!goal.trim()) return null;
    const goalKey = goal.trim().substring(0, 30).replace(/[^a-zA-Z0-9-_]/g, '_');
    return `${ASSISTANT_HISTORY_BASE_PREFIX}${characterId}_${goalKey}`;
  }, [goal, characterId]);

  useEffect(() => {
    setIsInitialGoalLoadDone(false); // Reset for new character
    const goalStorageKey = getCurrentGoalStorageKey();
    const savedGoal = localStorage.getItem(goalStorageKey);
    setGoal(savedGoal || '');
    setPartnerMessage('');
    setSuggestedReply('');
    // conversationHistory will be reset/loaded by the next effect
    setError(null);
    setIsInitialGoalLoadDone(true); // Mark goal load as done
  }, [characterId, getCurrentGoalStorageKey]); // Only depends on character context for goal key

  useEffect(() => {
    if (!isInitialGoalLoadDone) return; // Wait for goal to be determined

    setIsInitialHistoryLoadDone(false); // Reset for new history load
    const historyKey = getConversationHistoryStorageKey();
    if (historyKey) {
      const savedHistory = localStorage.getItem(historyKey);
      if (savedHistory) {
        try {
          const parsed = JSON.parse(savedHistory);
          setConversationHistory(Array.isArray(parsed) ? parsed : []);
        } catch (e) {
          setConversationHistory([]);
        }
      } else {
        setConversationHistory([]);
      }
    } else {
      setConversationHistory([]);
    }
    setIsInitialHistoryLoadDone(true); // Mark history load as done
  }, [goal, characterId, getConversationHistoryStorageKey, isInitialGoalLoadDone]); // Depends on goal and character (via key)

  useEffect(() => {
    if (!isInitialGoalLoadDone) return;
    const goalStorageKey = getCurrentGoalStorageKey();
    if (goal.trim()) {
      localStorage.setItem(goalStorageKey, goal);
    } else {
      localStorage.removeItem(goalStorageKey);
    }
  }, [goal, getCurrentGoalStorageKey, isInitialGoalLoadDone]);

  useEffect(() => {
    if (!isInitialHistoryLoadDone) return;
    const historyKey = getConversationHistoryStorageKey();
    if (historyKey) {
      if (conversationHistory.length > 0) {
        localStorage.setItem(historyKey, JSON.stringify(conversationHistory));
      } else {
        localStorage.removeItem(historyKey);
      }
    }
  }, [conversationHistory, getConversationHistoryStorageKey, isInitialHistoryLoadDone]);


  const handleGetSuggestion = async () => {
    if (!partnerMessage.trim() || !goal.trim()) { setError("請先設定目標並輸入對方說的話。"); return; }
    if (isLoading) return;
    setIsLoading(true); setError(null); setSuggestedReply('');

    const messagesForOllama = [
        ...conversationHistory.map(turn => [
            { role: 'user', content: turn.partner }, 
            { role: 'assistant', content: turn.suggestion }
        ]).flat(),
        { role: 'user', content: partnerMessage } 
    ];

    try {
      const responseText = await sendMessageToOllama(goal, messagesForOllama, interactingWithCharacter, "assistant");
      setSuggestedReply(responseText);
      setConversationHistory(prev => [...prev, { partner: partnerMessage, suggestion: responseText, timestamp: Date.now() }]);
      setPartnerMessage(''); 
    } catch (err) {
      console.error("Error in handleGetSuggestion (ChatAssistant):", err);
      setError(err.message || "獲取建議時發生錯誤。");
      setSuggestedReply('');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handlePartnerMessageKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !isLoading && partnerMessage.trim() && goal.trim()) {
      e.preventDefault();
      handleGetSuggestion();
    }
  };

  const handleClearHistory = () => {
    const historyKey = getConversationHistoryStorageKey(); 
    if (historyKey && window.confirm(`確定要清除目標「${goal}」 (針對角色「${interactingWithCharacter?.name || '通用'}」) 的所有助手對話記錄嗎？`)) {
        setConversationHistory([]); 
        setSuggestedReply('');
    } else if (!goal.trim()) {
        alert("請先設定一個目標才能清除其記錄。");
    }
  };

  const renderMarkdown = (markdownText) => {
    if (!markdownText) return null;
    try {
      const rawHtml = marked.parse(markdownText);
      return DOMPurify.sanitize(rawHtml);
    } catch (e) {
      console.error("Markdown parsing error", e);
      return markdownText.replace(/</g, "<").replace(/>/g, ">").replace(/\n/g, '<br />');
    }
  };

  return (
    <Container fluid className="py-3 px-md-4" style={{maxWidth: '1000px'}}>
      <Row className="mb-3 align-items-center">
        <Col md={interactingWithCharacter && interactingWithCharacter.id !== 'generic' ? 7 : 12 }>
          <h2 className="mb-0">💡 聊天助手</h2>
          {interactingWithCharacter && interactingWithCharacter.id !== 'generic' && (
            <p className="text-muted mb-0 small">
              為與 <strong>{interactingWithCharacter.name}</strong> 的對話提供建議
            </p>
          )}
        </Col>
        {interactingWithCharacter && interactingWithCharacter.id !== 'generic' && (
            <Col md={5} className="text-md-end mt-2 mt-md-0 d-flex align-items-center justify-content-end">
                {interactingWithCharacter.imageUrl && (
                    <Image 
                        src={interactingWithCharacter.imageUrl} 
                        roundedCircle 
                        style={{width: '30px', height: '30px', objectFit: 'cover', marginRight: '8px', border: '1px solid #ccc'}}
                        alt={interactingWithCharacter.name}
                        onError={(e) => { e.target.style.display = 'none';}}
                    />
                )}
                <span className="text-muted small me-2">聊天對象:</span>
                <Button 
                    variant="outline-secondary" 
                    size="sm" 
                    onClick={() => alert(`助手將針對與 ${interactingWithCharacter.name} (${interactingWithCharacter.description.substring(0,50)}...) 的互動提供建議。`)}
                    title={`${interactingWithCharacter.name} - ${interactingWithCharacter.description.substring(0,50)}...`}
                >
                    <i className="bi bi-person-check-fill me-1"></i> {interactingWithCharacter.name}
                </Button>
            </Col>
        )}
      </Row>
      <p className="text-muted mb-4">
        輸入你的溝通目標和聊天對象說的話，AI 將為你草擬建議的回覆。
        {interactingWithCharacter && interactingWithCharacter.id !== 'generic' ? 
            ` AI 會盡量模仿 ${interactingWithCharacter.name} 的風格來建議你如何回應。` : 
            ` AI 會以通用大學生風格提供建議。`}
      </p>

      <Row>
        <Col md={12} className="mb-3">
          <InputGroup>
            <InputGroup.Text>🎯</InputGroup.Text>
            <Form.Control
              type="text"
              placeholder={`設定與 ${interactingWithCharacter?.name || '對方'} 的溝通目標...`}
              value={goal}
              onChange={(e) => { setGoal(e.target.value); setError(null); }}
              disabled={isLoading}
            />
          </InputGroup>
        </Col>
      </Row>

      {error && ( <Alert variant="danger" onClose={() => setError(null)} dismissible className="mb-3"> {error} </Alert> )}

      <Card className="mb-3 shadow-sm">
        <Card.Header as="h5">互動面板</Card.Header>
        <Card.Body>
          <Form.Group className="mb-3">
            <Form.Label>{interactingWithCharacter?.name || '對方'} 說的話：<span className="text-danger">*</span></Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              placeholder="輸入對方傳來的訊息..."
              value={partnerMessage}
              onChange={(e) => setPartnerMessage(e.target.value)}
              onKeyDown={handlePartnerMessageKeyDown}
              disabled={isLoading || !goal.trim()}
              style={{ resize: 'none', overflowY: 'auto', maxHeight: '150px' }}
            />
          </Form.Group>
          <Button variant="primary" onClick={handleGetSuggestion} disabled={isLoading || !partnerMessage.trim() || !goal.trim()} className="w-100" >
            {isLoading ? ( <> <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> <span className="ms-2">思考建議中...</span> </> ) : ( "獲取回覆建議" )}
          </Button>
        </Card.Body>
      </Card>

      {suggestedReply && ( <Card className="mb-3 shadow-sm"> <Card.Header as="h5" className="bg-success text-white">AI 建議回覆：</Card.Header> <Card.Body> <div className="p-2 rounded assistant-suggestion" style={{ whiteSpace: 'pre-wrap', background: '#f0fff0', minHeight: '50px' }} dangerouslySetInnerHTML={{ __html: renderMarkdown(suggestedReply) }} /> <Button variant="outline-secondary" size="sm" className="mt-2" onClick={() => { const textToCopy = suggestedReply.replace(/<br\s*\/?>/gi, '\n').replace(/</g, '<').replace(/>/g, '>'); navigator.clipboard.writeText(textToCopy); alert("建議已複製！"); }} title="複製建議文字" > <i className="bi bi-clipboard me-1"></i> 複製文字 </Button> </Card.Body> </Card> )}
      
      {conversationHistory.length > 0 && goal.trim() && (
        <div className="mt-4"> 
            <div className="d-flex justify-content-between align-items-center mb-2"> 
                <h5>最近對話記錄 (目標: {goal} / 角色: {interactingWithCharacter?.name || '通用'})</h5> 
                <Button variant="outline-secondary" size="sm" onClick={handleClearHistory} disabled={isLoading || !goal.trim()}> <i className="bi bi-trash3 me-1"></i> 清除此記錄 </Button> 
            </div> 
            <div className="assistant-history-display" style={{maxHeight: '300px', overflowY: 'auto', border: '1px solid #eee', padding: '10px', borderRadius: '5px'}}> 
                {conversationHistory.slice().reverse().map((turn, index) => ( 
                    <Card key={turn.timestamp || `turn-${index}`} className="mb-2 small"> 
                        <Card.Body className="p-2"> 
                            <p className="mb-1"><strong>{interactingWithCharacter?.name || '對方'}:</strong> <span dangerouslySetInnerHTML={{__html: renderMarkdown(turn.partner)}}/></p> 
                            <p className="mb-0" style={{color: 'green'}}><strong>AI建議:</strong> <span dangerouslySetInnerHTML={{__html: renderMarkdown(turn.suggestion)}} /></p> 
                            <small className="text-muted">{new Date(turn.timestamp).toLocaleString()}</small> 
                        </Card.Body> 
                    </Card> 
                ))} 
            </div> 
        </div> 
      )}
    </Container>
  );
}
export default ChatAssistant;