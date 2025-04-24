import React, { useState, useEffect } from 'react';
import { Container } from 'react-bootstrap';
import AppNavbar from './components/common/AppNavbar';
import TrainingRoom from './components/TrainingRoom/TrainingRoom';
import CharacterHall from './components/CharacterHall/CharacterHall';
import FeedbackWall from './components/FeedbackWall/FeedbackWall';
import './styles/App.css';

// 本地儲存的 Key
const CHARACTERS_STORAGE_KEY = 'wingchat_characters';

function App() {
  const [activeView, setActiveView] = useState('training'); // 'training', 'characters', 'feedback'
  const [characters, setCharacters] = useState(() => {
    // 從 localStorage 加載初始角色，或使用預設值
    const savedCharacters = localStorage.getItem(CHARACTERS_STORAGE_KEY);
    if (savedCharacters) {
      try {
        return JSON.parse(savedCharacters);
      } catch (e) {
        console.error("Failed to parse characters from localStorage", e);
        return [{ id: 'default', name: '預設助手', description: '我是 WingChat，一個友善且樂於助人的 AI 社交教練。' }];
      }
    }
    return [{ id: 'default', name: '預設助手', description: '我是 WingChat，一個友善且樂於助人的 AI 社交教練。' }];
  });
  const [selectedCharacter, setSelectedCharacter] = useState(characters.length > 0 ? characters[0] : null); // 預設選中第一個

  // 當 characters 狀態改變時，保存到 localStorage
  useEffect(() => {
    localStorage.setItem(CHARACTERS_STORAGE_KEY, JSON.stringify(characters));
  }, [characters]);

  // 更新角色列表處理函數
  const handleUpdateCharacters = (newCharacters) => {
    setCharacters(newCharacters);
    // 檢查當前選中角色是否還存在
    if (selectedCharacter && !newCharacters.find(c => c.id === selectedCharacter.id)) {
      setSelectedCharacter(newCharacters.length > 0 ? newCharacters[0] : null); // 如果不存在，選第一個或設為 null
    } else if (!selectedCharacter && newCharacters.length > 0) {
        setSelectedCharacter(newCharacters[0]); // 如果之前沒有選中，現在有了就選第一個
    }
  };

  // 選擇角色處理函數
  const handleSelectCharacter = (character) => {
    setSelectedCharacter(character);
    setActiveView('training'); // 選完角色自動跳回訓練室
  };

  // 渲染當前視圖
  const renderView = () => {
    switch (activeView) {
      case 'characters':
        return <CharacterHall
                  characters={characters}
                  onUpdateCharacters={handleUpdateCharacters}
                  onSelectCharacter={handleSelectCharacter}
                />;
      case 'feedback':
        // TODO: FeedbackWall 需要接收聊天記錄或其他分析數據
        // 這裡暫時只渲染基本組件
        return <FeedbackWall chatHistory={[]} />; // 假設未來會傳入聊天記錄
      case 'training':
      default:
        return <TrainingRoom selectedCharacter={selectedCharacter} />;
    }
  };

  return (
    <div className="app-container">
      <AppNavbar onSelectView={setActiveView} currentView={activeView} />
      <Container fluid className="main-content mt-3">
        {renderView()}
      </Container>
    </div>
  );
}

export default App;