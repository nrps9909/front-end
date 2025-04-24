import React, { useRef } from 'react'; // *** 移除 useEffect ***
import { Form, Button, InputGroup, Spinner } from 'react-bootstrap';

function MessageInput({
    currentMessage,
    onMessageChange,
    onSendMessage,
    onGetFeedback,
    isLoading,
    isGettingFeedback,
    disabled
}) {
  const textareaRef = useRef(null); // Ref 仍然保留，但不用於高度調整

  // *** 移除自動調整高度的 useEffect ***
  /*
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'; // Reset height
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`; // Set to scroll height
    }
  }, [currentMessage]);
  */

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !isLoading && !isGettingFeedback && !disabled && currentMessage.trim()) {
      e.preventDefault();
      onSendMessage();
    }
  };

  const handleSendClick = () => {
      if (!isLoading && !isGettingFeedback && !disabled && currentMessage.trim()) {
          onSendMessage();
      }
  }

  const handleFeedbackClick = () => {
      if (!isLoading && !isGettingFeedback && !disabled) {
          onGetFeedback();
      }
  }

  return (
    <InputGroup>
      {/* 快速回饋按鈕 */}
      <Button
        variant="outline-info"
        onClick={handleFeedbackClick}
        disabled={isLoading || isGettingFeedback || disabled}
        title="讓 AI 針對本次對話給出回饋"
      >
        {isGettingFeedback ? (
            <>
              <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
              <span className="visually-hidden">請求中...</span>
            </>
        ) : (
            "🤔 我說得如何？"
        )}
      </Button>

      <Form.Control
        ref={textareaRef} // Ref 仍然可以保留給未來可能的其他用途
        as="textarea"
        rows={2} // *** 設定固定的初始行數，例如 2 或 3 ***
        placeholder={disabled ? "請先設定目標並選擇角色..." : "輸入訊息 (Shift+Enter 換行)..."}
        value={currentMessage}
        onChange={(e) => onMessageChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isLoading || isGettingFeedback || disabled}
        // *** 保持這些樣式，允許內部滾動 ***
        style={{ resize: 'none', overflowY: 'auto', maxHeight: '150px' }}
        aria-label="訊息輸入框"
      />

      {/* 語音輸入預留圖示 (未來功能) */}
      {/*
      <Button variant="outline-secondary" disabled={isLoading || isGettingFeedback || disabled} title="語音輸入 (尚未啟用)">
          <i className="bi bi-mic"></i>
      </Button>
      */}

      <Button
        variant="primary"
        onClick={handleSendClick}
        disabled={isLoading || isGettingFeedback || disabled || !currentMessage.trim()}
      >
        {isLoading ? (
            <>
                <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true"/>
                <span className="visually-hidden">傳送中...</span>
            </>
        ) : (
             <i className="bi bi-send"></i>
        )}
      </Button>
    </InputGroup>
  );
}

export default MessageInput;