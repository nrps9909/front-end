import React, { useRef, useEffect, useLayoutEffect } from 'react';
import { Spinner, Alert } from 'react-bootstrap';
import ChatMessage from './ChatMessage';

function ChatDisplay({ messages, isLoading }) {
  const chatEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const prevMessagesLengthRef = useRef(messages.length);

  useLayoutEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const isScrollable = scrollContainer.scrollHeight > scrollContainer.clientHeight;
    // *** 判斷是否是「真的」新訊息加入（避免初始加載或清空觸發） ***
    const messagesWereAdded = messages.length > prevMessagesLengthRef.current;
    const scrollThreshold = 100;
    let isNearBottom = true;

    if (isScrollable) {
        // 檢查滾動位置是否接近底部
        isNearBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop <= scrollContainer.clientHeight + scrollThreshold;
    } else {
        // 如果不可滾動，總是視為在底部（以便第一條訊息出現時能滾動）
        isNearBottom = true;
    }

    // 只有在以下情況才滾動：
    // a) 確實有新訊息加入 (避免清空或初始加載觸發滾動)
    // b) 且用戶原本就在底部附近 (或容器不可滾動)
    if (messagesWereAdded && isNearBottom) {
        const timer = setTimeout(() => {
            // 確保 chatEndRef 存在
            chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
        }, 50); // 短延遲
        // 清理函數
        return () => clearTimeout(timer);
    }

    // 更新前一次的訊息數量，必須在判斷邏輯之後
    prevMessagesLengthRef.current = messages.length;

  }, [messages]); // 依賴項保持 messages


  return (
    <div
      ref={scrollContainerRef}
      className="chat-display-area" // 確認沒有 mb-3
      style={{
        overflowY: 'auto', // 允許滾動
        height: '100%',    // 佔滿父級 flex-grow 分配的高度
        display: 'flex',
        flexDirection: 'column',
        // justifyContent: 'flex-start' // 預設就是 flex-start，內容會從頂部開始
      }}
    >
      {/* 1. 空狀態提示 (如果沒有訊息) */}
      {messages.length === 0 && !isLoading && (
        <Alert variant="info" className="text-center small p-2 mx-auto mt-2" style={{maxWidth: '80%', flexShrink: 0 }}>
          設定好目標後，就可以開始和 AI 對話練習囉！
        </Alert>
      )}

      {/* 2. 訊息列表 - 直接 map */}
      {/* *** 移除外層帶有 marginTop: 'auto' 的 div *** */}
      {messages.map((msg) => (
        <ChatMessage key={msg.id} sender={msg.sender} text={msg.text} />
      ))}

      {/* 3. 加載指示器 (如果有正在加載) */}
      {isLoading && (
        <div className="d-flex justify-content-center align-items-center my-2 p-2 text-muted" style={{ flexShrink: 0 }}>
          <Spinner animation="border" role="status" size="sm" className="me-2">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
          AI 正在思考...
        </div>
      )}

      {/* 4. 滾動目標錨點 - 放在所有視覺內容的最後 */}
      <div ref={chatEndRef} style={{ height: '1px', flexShrink: 0 }} />
    </div>
  );
}

export default ChatDisplay;