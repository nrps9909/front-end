import React, { useState } from 'react';
import { Button, Row, Col, Card, Alert } from 'react-bootstrap';
import AddCharacterModal from './AddCharacterModal';

function CharacterHall({ characters, onUpdateCharacters, onSelectCharacter }) {
  const [showModal, setShowModal] = useState(false);

  const handleAddCharacter = (newCharacter) => {
    // 使用更可靠的 ID 生成方式 (例如 uuid 或時間戳 + 隨機數)
    const characterWithId = { ...newCharacter, id: `char_${Date.now()}_${Math.random().toString(36).substring(2, 7)}` };
    const updatedCharacters = [...characters, characterWithId];
    onUpdateCharacters(updatedCharacters); // 通知 App.js 更新狀態
  };

  const handleDeleteCharacter = (idToDelete) => {
    // 不允許刪除預設角色 (可選)
    if (idToDelete === 'default') {
        alert("無法刪除預設助手角色。");
        return;
    }
    const updatedCharacters = characters.filter(c => c.id !== idToDelete);
    onUpdateCharacters(updatedCharacters);
  };

  return (
    <div>
      <h2 className="mb-3">角色館</h2>
      <p className="text-muted mb-4">在這裡新增、管理你想互動練習的 AI 角色。選擇一個角色後，點擊「開始訓練」即可進入訓練室。</p>
      <Button variant="primary" onClick={() => setShowModal(true)} className="mb-4">
        <i className="bi bi-plus-lg me-2"></i>新增角色
      </Button>

      {characters.length === 0 && (
        <Alert variant="info">目前沒有任何自訂角色，快新增一個吧！</Alert>
      )}

      <Row xs={1} md={2} lg={3} xl={4} className="g-4">
        {characters.map((character) => (
          <Col key={character.id}>
            <Card className="h-100 shadow-sm character-card">
              <Card.Body className="d-flex flex-column">
                <Card.Title>{character.name}</Card.Title>
                <Card.Text className="text-muted small flex-grow-1 character-description">
                  {character.description}
                </Card.Text>
                <div className="mt-auto d-flex justify-content-between align-items-center pt-2">
                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => onSelectCharacter(character)}
                    title="選擇此角色並開始訓練"
                  >
                    <i className="bi bi-chat-dots-fill me-1"></i> 開始訓練
                  </Button>
                  {character.id !== 'default' && ( // 不顯示預設角色的刪除按鈕
                     <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={() => handleDeleteCharacter(character.id)}
                        title="刪除此角色"
                     >
                       <i className="bi bi-trash3"></i>
                     </Button>
                  )}
                   {character.id === 'default' && (
                        <span style={{ width: '31px' }}></span> // 佔位，保持對齊
                   )}
                </div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      <AddCharacterModal
        show={showModal}
        onHide={() => setShowModal(false)}
        onAddCharacter={handleAddCharacter}
      />

      {/* 可以在 App.css 中添加一些樣式 */}
      <style jsx global>{`
        .character-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important;
          transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
        }
        .character-description {
           display: -webkit-box;
           -webkit-line-clamp: 3; /* 最多顯示 3 行 */
           -webkit-box-orient: vertical;
           overflow: hidden;
           text-overflow: ellipsis;
           min-height: 60px; /* 確保至少有一定高度 */
        }
      `}</style>
    </div>
  );
}

export default CharacterHall;