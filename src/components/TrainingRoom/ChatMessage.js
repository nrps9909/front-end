import React from 'react';
import { marked } from 'marked'; // 引入 marked 庫來解析 Markdown
import DOMPurify from 'dompurify'; // 引入 DOMPurify 來清理 HTML

// 設定 marked 選項 (可選，例如啟用 GFM)
marked.setOptions({
  gfm: true, // 啟用 GitHub Flavored Markdown
  breaks: true, // 將換行符轉換為 <br>
});

function ChatMessage({ sender, text }) {
  const isUser = sender === 'user';
  const isSystem = sender === 'system'; // 處理系統訊息
  const messageClass = isUser ? 'message user-message' : (isSystem ? 'message system-message' : 'message ai-message');
  const rowClass = isUser ? 'user-row' : (isSystem ? 'system-row' : 'ai-row');

  // 解析 Markdown 並清理 HTML
  // 使用 try-catch 以防解析出錯
  let cleanHtml = text; // 預設為原始文字
  if (sender === 'ai' || sender === 'system') { // 只對 AI 或系統訊息解析 Markdown
      try {
          // 先用 marked 將 Markdown 轉成 HTML，再用 DOMPurify 清理
          const rawHtml = marked.parse(text);
          cleanHtml = DOMPurify.sanitize(rawHtml);
      } catch (error) {
          console.error("Error parsing markdown or sanitizing HTML:", error);
          // 如果出錯，使用原始文本，並進行基本的 HTML 轉義以防 XSS
          cleanHtml = text.replace(/</g, "<").replace(/>/g, ">");
      }
  } else {
      // 對於使用者輸入，只做基本的換行處理和 HTML 轉義
      cleanHtml = text.replace(/</g, "<").replace(/>/g, ">").replace(/\n/g, '<br />');
  }


  return (
    <div className={`message-row ${rowClass}`}>
       {/* AI/System 訊息顯示在右側或中間 */}
       {!isUser && <div className="spacer"></div>}

       <div className={messageClass}>
         {/* 使用清理過的 HTML */}
         <div dangerouslySetInnerHTML={{ __html: cleanHtml }} />
       </div>

       {/* 使用者訊息顯示在左側 */}
        {isUser && <div className="spacer"></div>}
    </div>
  );
}

export default ChatMessage;