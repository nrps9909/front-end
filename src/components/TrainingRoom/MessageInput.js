// src/components/TrainingRoom/MessageInput.js
import React, { useRef, useEffect } from 'react';
import { Form, Button, InputGroup, Spinner } from 'react-bootstrap';

function MessageInput({
    currentMessage,
    onMessageChange,
    onSendMessage,
    onGetFeedback,
    isLoading,
    isGettingFeedback,
    disabled,
    showFeedbackButton = false
}) {
  const textareaRef = useRef(null);

  // 自動調整輸入框高度
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = '0px';
      const newHeight = Math.min(120, textarea.scrollHeight);
      textarea.style.height = `${newHeight}px`;
    }
  }, [currentMessage]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !isLoading && !isGettingFeedback && !disabled) {
      e.preventDefault();
      if (currentMessage.trim() !== '') {
          onSendMessage();
          if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'; 
          }
      }
    }
  };

  const handleSendClick = () => {
      if (!isLoading && !isGettingFeedback && !disabled && currentMessage.trim()) {
          onSendMessage();
          if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'; 
          }
      }
  }

  const handleFeedbackClick = () => {
      if (!isLoading && !isGettingFeedback && !disabled && onGetFeedback) {
          onGetFeedback();
      }
  }

  // IG 風格輸入框
  return (
    <InputGroup className="instagram-input">
      {showFeedbackButton && onGetFeedback && (
        <Button
          variant="link"
          onClick={handleFeedbackClick}
          disabled={isLoading || isGettingFeedback || disabled}
          title="讓 AI 針對您在本次對話中的表現給出回饋"
          className="ig-button"
          style={{
            color: '#0095F6',
            background: 'none',
            border: 'none',
            fontSize: '1rem',
            padding: '0 15px'
          }}
        >
          {isGettingFeedback ? (
              <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
          ) : (
              <i className="bi bi-emoji-smile"></i>
          )}
        </Button>
      )}

      <Form.Control
        ref={textareaRef}
        as="textarea"
        rows={1}
        placeholder={disabled ? "請先完成上方設定..." : "傳送訊息..."}
        value={currentMessage}
        onChange={(e) => onMessageChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isLoading || isGettingFeedback || disabled}
        style={{ 
          resize: 'none', 
          overflow: 'hidden', 
          minHeight: '38px',
          maxHeight: '120px',
          transition: 'height 0.1s ease',
          border: 'none',
          borderRadius: '20px',
          padding: '8px 12px',
          background: '#EFEFEF',
          fontSize: '0.95rem'
        }} 
        aria-label="訊息輸入框"
      />

      <Button
        variant="link"
        onClick={handleSendClick}
        disabled={isLoading || isGettingFeedback || disabled || !currentMessage.trim()}
        style={{
          color: currentMessage.trim() ? '#0095F6' : '#B2DFFC',
          background: 'none',
          border: 'none',
          fontWeight: 'bold',
          fontSize: '0.9rem',
          padding: '0 10px'
        }}
      >
        {isLoading ? (
            <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true"/>
        ) : (
            "傳送"
        )}
      </Button>
    </InputGroup>
  );
}

export default MessageInput;