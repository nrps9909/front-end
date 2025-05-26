// src/components/TrainingRoom/ChatMessage.js
import React from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { Image } from 'react-bootstrap';

marked.setOptions({
  gfm: true,
  breaks: true,
});

function ChatMessage({ sender, text, avatarUrl }) {
  const isUser = sender === 'user';
  const isSystem = sender === 'system';
  const isAI = sender === 'ai';

  // Fix: use ternary operator for all conditions to avoid reassignment
  const rowClass = isSystem 
    ? 'd-flex justify-content-center' 
    : (isUser ? 'd-flex justify-content-end' : 'd-flex justify-content-start');
  
  // 訊息容器的 class - IG 風格配置
  let messageContainerClass = 'd-flex align-items-end';

  // 訊息氣泡的 class - IG 風格
  let messageBubbleClass = 'message';
  if (isUser) {
    messageBubbleClass += ' user-message'; 
  } else if (isSystem) {
    messageBubbleClass += ' system-message'; 
  } else { // AI 訊息
    messageBubbleClass += ' ai-message';
    if (avatarUrl) {
        messageBubbleClass += ' ms-2'; 
    }
  }

  // 訊息氣泡的樣式 - IG 風格
  const messageStyle = {
    maxWidth: isSystem ? '90%' : '70%',
    wordBreak: 'break-word',
  };

  // Markdown 解析和 HTML 清理
  let cleanHtml = text;
  if (isAI || isSystem) {
      try {
          // 为 AI 消息添加特殊处理，保留换行但不添加额外换行
          const rawHtml = marked.parse(text);
          cleanHtml = DOMPurify.sanitize(rawHtml);
          
          // 如果 marked 生成的 HTML 包含过多的段落或换行，可以在这里进行处理
          if (isAI && cleanHtml.includes('<p>') && cleanHtml.includes('</p>')) {
              // 保留 markdown 格式，但统一段落处理
              cleanHtml = cleanHtml.replace(/<\/p>\s*<p>/g, '<br />');
              cleanHtml = cleanHtml.replace(/<p>|<\/p>/g, '');
          }
      } catch (error) {
          console.error("Markdown 解析或 HTML 清理錯誤:", error);
          cleanHtml = text.replace(/&/g, "&amp;")
                          .replace(/</g, "&lt;")
                          .replace(/>/g, "&gt;")
                          .replace(/"/g, "&quot;")
                          .replace(/'/g, "&#39;");
          // 只有当明确有换行符时才转换为 <br/>
          if (text.includes('\n')) {
              cleanHtml = cleanHtml.replace(/\n/g, "<br />");
          }
      }
  } else { // 使用者訊息，做基本轉義但不將換行符自動轉為<br/>
      cleanHtml = text.replace(/&/g, "&amp;")
                      .replace(/</g, "&lt;")
                      .replace(/>/g, "&gt;")
                      .replace(/"/g, "&quot;")
                      .replace(/'/g, "&#39;");
      // 只有當用戶明確輸入換行符時才轉換為<br/>
      if (text.includes('\n')) {
          cleanHtml = cleanHtml.replace(/\n/g, "<br />");
      }
  }

  // IG 風格系統訊息處理
  if (isSystem) {
    // 檢查是否為評估訊息，包含 "AI 對您的表現評估" 的系統訊息
    const isEvaluation = text.includes("AI 對您的表現評估");
    
    return (
      <div className={`d-flex ${isEvaluation ? 'justify-content-start' : 'justify-content-center'} my-2`}>
        <div className={`${messageBubbleClass} ${isEvaluation ? 'evaluation-message' : ''}`} style={messageStyle}>
          <div dangerouslySetInnerHTML={{ __html: cleanHtml }} className={isEvaluation ? 'text-start' : ''} />
        </div>
      </div>
    );
  }

  // 修改使用者訊息的顯示樣式，修正對齊問題
  if (isUser) {
    return (
      <div className={`message-row ${rowClass} mb-2`}>
        <div className="user-message-container">
          <div className={messageBubbleClass} style={{
            ...messageStyle,
            display: 'inline-block',
            whiteSpace: 'normal', // 改為normal讓文字自然換行
            wordBreak: 'break-word',
            textAlign: 'left'
          }}>
            <div dangerouslySetInnerHTML={{ __html: cleanHtml }} />
          </div>
        </div>
      </div>
    );
  }

  // 修改 AI 消息的顯示樣式，使其與使用者消息保持一致的文本處理
  return (
    <div className={`message-row ${rowClass} mb-2`}>
      <div className={messageContainerClass}>
        {isAI && avatarUrl && (
          <Image 
            src={avatarUrl} 
            roundedCircle 
            alt="ai avatar" 
            className="chat-avatar" 
            style={{ 
                width: '28px', 
                height: '28px', 
                objectFit: 'cover', 
                alignSelf: 'flex-end',
                marginRight: '8px'
            }}
            onError={(e) => { e.target.style.display = 'none';}}
          />
        )}
        <div className={messageBubbleClass} style={{
          ...messageStyle,
          whiteSpace: 'normal', // 为所有消息类型使用相同的空白处理
          wordBreak: 'break-word',
          textAlign: 'left'
        }}>
          <div dangerouslySetInnerHTML={{ __html: cleanHtml }} />
        </div>
      </div>
    </div>
  );
}

export default ChatMessage;