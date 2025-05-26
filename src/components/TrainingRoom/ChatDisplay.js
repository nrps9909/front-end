// src/components/TrainingRoom/ChatDisplay.js
import React, { useRef, useLayoutEffect } from 'react';
import { Spinner, Alert } from 'react-bootstrap';
import ChatMessage from './ChatMessage';

function ChatDisplay({ messages, isLoading, aiAvatarUrl }) {
  const chatEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const prevMessagesLengthRef = useRef(messages.length);

  useLayoutEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const messagesWereAdded = messages.length > prevMessagesLengthRef.current;
    // 只有當新訊息加入且使用者已經在底部附近時才自動滾動
    const scrollThreshold = 150; // 可以調整這個值，判斷多接近底部才算“在底部”
    let isNearBottom = true;

    if (scrollContainer.scrollHeight > scrollContainer.clientHeight) { // 判斷是否可滾動
        isNearBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop <= scrollContainer.clientHeight + scrollThreshold;
    }
    
    if (messagesWereAdded && isNearBottom) {
        const timer = setTimeout(() => { // 使用 setTimeout 確保 DOM 更新完成
            chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
        }, 50); 
        return () => clearTimeout(timer); // 清理 timeout
    }
    prevMessagesLengthRef.current = messages.length; // 更新上一次的訊息數量
  }, [messages]); // 依賴 messages 陣列


  return (
    <div
      ref={scrollContainerRef}
      className="chat-display-area" 
      style={{
        overflowY: 'auto',
        height: '100%',    
        display: 'flex',
        flexDirection: 'column',
        padding: '0 8px',
        backgroundColor: 'white',
        msOverflowStyle: 'auto', // 為IE添加
        scrollbarWidth: 'auto', // 為Firefox添加
        WebkitOverflowScrolling: 'touch' // 為iOS添加滾动慣性
      }}
    >
      {messages.length === 0 && !isLoading && (
        <div className="text-center my-4">
          <div style={{color: '#8E8E8E', fontSize: '0.9rem'}}>
            開始和 AI 角色對話練習吧！
          </div>
        </div>
      )}

      {messages.map((msg) => (
        <ChatMessage 
            key={msg.id} 
            sender={msg.sender} 
            text={msg.text} 
            avatarUrl={msg.sender === 'ai' ? aiAvatarUrl : null}
        />
      ))}

      {isLoading && (
        <div className="d-flex justify-content-start align-items-center my-2" style={{ flexShrink: 0 }}>
          <div className="d-flex align-items-center ms-3" style={{ color: '#8E8E8E', fontSize: '0.8rem' }}>
            <div className="typing-indicator me-2">
              <span></span><span></span><span></span>
            </div>
            正在輸入
          </div>
        </div>
      )}
      <div ref={chatEndRef} style={{ height: '1px', flexShrink: 0 }} /> 
    </div>
  );
}

export default ChatDisplay;