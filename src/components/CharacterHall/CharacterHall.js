import React, { useState } from 'react';
import { Button, Row, Col, Card, Alert } from 'react-bootstrap'; // Removed Image, using Card.Img
import AddCharacterModal from './AddCharacterModal';

function CharacterHall({
  characters,
  onUpdateCharacters,
  onStartTraining,
  onStartAssistantWithCharacter,
}) {
  const [showModal, setShowModal] = useState(false);
  const [characterToEdit, setCharacterToEdit] = useState(null);

  const handleShowAddModal = () => {
    setCharacterToEdit(null);
    setShowModal(true);
  };

  const handleShowEditModal = (character) => {
    setCharacterToEdit(character);
    setShowModal(true);
  };

  const handleAddCharacter = (newCharacterData) => {
    const characterWithId = {
      ...newCharacterData, // Spread data from modal (name, description, imageUrl)
      id: `char_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      isDefault: false,
      // Ensure imageUrl is part of the object, even if null
      imageUrl: newCharacterData.imageUrl || null,
    };
    const updatedCharacters = [...characters, characterWithId];
    onUpdateCharacters(updatedCharacters);
  };

  const handleEditCharacter = (editedCharacterData) => {
    const updatedCharacters = characters.map(char =>
      char.id === editedCharacterData.id ? 
      { ...char, ...editedCharacterData, imageUrl: editedCharacterData.imageUrl || null } // Ensure imageUrl is updated
      : char
    );
    onUpdateCharacters(updatedCharacters);
  };

  const handleDeleteCharacter = (idToDelete) => {
    if (characters.find(c => c.id === idToDelete)?.isDefault) {
      alert("無法刪除預設角色。");
      return;
    }
    if (window.confirm("確定要刪除此角色嗎？此操作無法復原。")) {
        const updatedCharacters = characters.filter(c => c.id !== idToDelete);
        onUpdateCharacters(updatedCharacters);
    }
  };

  return (
    <div>
      <h2 className="mb-3">角色館</h2>
      <p className="text-muted mb-4">
        新增、管理、編輯你的 AI 角色。選擇一個角色開始訓練，或讓 AI 扮演該角色為你提供聊天建議。
      </p>
      <Button variant="primary" onClick={handleShowAddModal} className="mb-4">
        <i className="bi bi-plus-lg me-2"></i>新增角色
      </Button>

      {characters.length === 0 && (
        <Alert variant="info">目前沒有任何角色，快新增一個吧！</Alert>
      )}

      <Row xs={1} md={2} lg={3} xl={4} className="g-4">
        {characters.map((character) => (
          <Col key={character.id}>
            <Card className="h-100 shadow-sm character-card">
              {character.imageUrl && (
                <Card.Img 
                  variant="top" 
                  src={character.imageUrl} 
                  alt={character.name} 
                  className="character-card-img" // Added a class for potential specific styling
                  onError={(e) => { 
                    e.target.onerror = null; // Prevent infinite loop if placeholder also fails
                    e.target.style.display = 'none'; // Hide broken image
                    // Optionally, replace with a placeholder:
                    // e.target.src = "/path/to/default-placeholder.png"; 
                  }}
                />
              )}
              <Card.Body className="d-flex flex-column">
                <Card.Title>{character.name}</Card.Title>
                <Card.Text className="text-muted small flex-grow-1 character-description">
                  {character.description}
                </Card.Text>
                <div className="mt-auto pt-2">
                  <div className="d-grid gap-2 mb-2">
                    <Button
                      variant="success"
                      size="sm"
                      onClick={() => onStartTraining(character)}
                      title="選擇此角色並進入訓練室"
                    >
                      <i className="bi bi-chat-dots-fill me-1"></i> 開始訓練
                    </Button>
                    <Button
                      variant="info"
                      size="sm"
                      onClick={() => onStartAssistantWithCharacter(character)}
                      title="讓 AI 扮演此角色為你提供聊天建議"
                    >
                      <i className="bi bi-lightbulb-fill me-1"></i> 聊天助手
                    </Button>
                  </div>
                  <div className="d-flex mt-2">
                    {!character.isDefault && (
                      <Button
                          variant="outline-secondary"
                          size="sm"
                          onClick={() => handleShowEditModal(character)}
                          title="編輯此角色"
                          className="me-1 flex-grow-1" // Added margin and flex
                      >
                        <i className="bi bi-pencil-square"></i> 編輯
                      </Button>
                    )}
                    {!character.isDefault ? (
                      <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => handleDeleteCharacter(character.id)}
                          title="刪除此角色"
                          className="flex-grow-1" // Added flex
                      >
                        <i className="bi bi-trash3"></i> 刪除
                      </Button>
                    ) : (
                        // This div ensures that if there's no edit button, 
                        // the (non-existent) delete button area doesn't cause a jump
                        // For default characters, there are no buttons here.
                        // If you want to ensure consistent height even for default cards,
                        // you might need a placeholder with fixed height.
                        // For now, this allows cards to have varying button sections.
                        <div style={{ minHeight: '32px' }}></div> // Approx height of a small button
                    )}
                  </div>
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
        onEditCharacter={handleEditCharacter}
        characterToEdit={characterToEdit}
      />

      <style jsx global>{`
        .character-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important;
          transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
        }
        .character-description {
           display: -webkit-box;
           -webkit-line-clamp: 3;
           -webkit-box-orient: vertical;
           overflow: hidden;
           text-overflow: ellipsis;
           min-height: 60px; 
        }
        .character-card-img {
            height: 180px; 
            object-fit: cover; /* Ensures image covers the area, might crop */
            border-bottom: 1px solid #dee2e6;
        }
      `}</style>
    </div>
  );
}

export default CharacterHall;