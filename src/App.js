// src/App.js
import React, { useState, useEffect } from 'react';
import { Container, Button } from 'react-bootstrap'; // IMPORTED Button
import AppNavbar from './components/common/AppNavbar';
import TrainingRoom from './components/TrainingRoom/TrainingRoom';
import CharacterHall from './components/CharacterHall/CharacterHall';
import FeedbackWall from './components/FeedbackWall/FeedbackWall';
import ChatAssistant from './components/Chat/ChatAssistant';
import './styles/App.css';

const CHARACTERS_STORAGE_KEY = 'wingchat_characters';
const LAST_VIEW_STORAGE_KEY = 'wingchat_last_view';
const LAST_TRAINING_CHAR_ID_KEY = 'wingchat_last_training_char_id';
const LAST_ASSISTANT_CHAR_ID_KEY = 'wingchat_last_assistant_char_id';

const DEFAULT_CHARACTERS = [
  {
    id: 'default_assistant_char',
    name: '通用助手 (預設)',
    description: '一位友善的通用型 AI 助手，適合一般聊天建議。',
    imageUrl: null,
    isDefault: true,
  },
  {
    id: 'default_training_char',
    name: '健談的鄰居 (預設)',
    description: '一位友善、開朗且健談的鄰居，喜歡閒聊家常。',
    imageUrl: null,
    isDefault: true,
  },
  {
    id: 'interviewer_hr',
    name: 'HR 面試官 (嚴謹型)',
    description: '一位嚴謹、注重細節的 HR 面試官。語氣專業，會針對履歷提問，並追問細節。目標是評估你的專業素養和溝通能力。',
    imageUrl: null,
    isDefault: false,
  },
];

function App() {
  const [characters, setCharacters] = useState(() => {
    const savedCharacters = localStorage.getItem(CHARACTERS_STORAGE_KEY);
    if (savedCharacters) {
      try {
        const parsed = JSON.parse(savedCharacters);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(char => ({ imageUrl: char.imageUrl !== undefined ? char.imageUrl : null, ...char }));
        }
      } catch (e) { console.error("Failed to parse characters from localStorage", e); }
    }
    const initialCharacters = DEFAULT_CHARACTERS.map(char => ({ imageUrl: null, ...char }));
    localStorage.setItem(CHARACTERS_STORAGE_KEY, JSON.stringify(initialCharacters));
    return initialCharacters;
  });

  const [selectedCharacterForTraining, setSelectedCharacterForTraining] = useState(() => {
    const lastCharId = localStorage.getItem(LAST_TRAINING_CHAR_ID_KEY);
    // Need to use the initial characters state for this first lookup
    const initialCharsForLookup = JSON.parse(localStorage.getItem(CHARACTERS_STORAGE_KEY) || JSON.stringify(DEFAULT_CHARACTERS));
    if (lastCharId) {
        const char = initialCharsForLookup.find(c => c.id === lastCharId);
        if (char) return char;
    }
    return initialCharsForLookup.find(c => c.id === 'default_training_char') || (initialCharsForLookup.length > 0 ? initialCharsForLookup[0] : null);
  });

  const [characterForAssistant, setCharacterForAssistant] = useState(() => {
    const lastCharId = localStorage.getItem(LAST_ASSISTANT_CHAR_ID_KEY);
    const initialCharsForLookup = JSON.parse(localStorage.getItem(CHARACTERS_STORAGE_KEY) || JSON.stringify(DEFAULT_CHARACTERS));
     if (lastCharId) {
        const char = initialCharsForLookup.find(c => c.id === lastCharId);
        if (char) return char;
    }
    return initialCharsForLookup.find(c => c.id === 'default_assistant_char') || (initialCharsForLookup.length > 0 ? initialCharsForLookup[0] : null);
  });

  const [activeView, setActiveView] = useState(() => {
    const savedView = localStorage.getItem(LAST_VIEW_STORAGE_KEY);
    return savedView || 'training';
  });

  useEffect(() => {
    const charactersWithImageUrl = characters.map(char => ({ 
        imageUrl: char.imageUrl !== undefined ? char.imageUrl : null, 
        ...char 
    }));
    // Avoid unnecessary update if the structure is already correct
    if (characters.some(char => char.imageUrl === undefined)) {
        // This condition is a bit flawed, a deep comparison or more specific flag might be better
        // For now, this ensures imageUrl is present.
        // This check is primarily for migration from an old state without imageUrl.
        // A better approach for migration is a one-time check function.
    }
    localStorage.setItem(CHARACTERS_STORAGE_KEY, JSON.stringify(charactersWithImageUrl));
  }, [characters]);

  useEffect(() => {
    localStorage.setItem(LAST_VIEW_STORAGE_KEY, activeView);
  }, [activeView]);

  useEffect(() => {
    if (selectedCharacterForTraining) {
        localStorage.setItem(LAST_TRAINING_CHAR_ID_KEY, selectedCharacterForTraining.id);
    } else {
        localStorage.removeItem(LAST_TRAINING_CHAR_ID_KEY);
    }
  }, [selectedCharacterForTraining]);

  useEffect(() => {
    if (characterForAssistant) {
        localStorage.setItem(LAST_ASSISTANT_CHAR_ID_KEY, characterForAssistant.id);
    } else {
        localStorage.removeItem(LAST_ASSISTANT_CHAR_ID_KEY);
    }
  }, [characterForAssistant]);

  const handleUpdateCharacters = (newCharacters) => {
    const ensuredNewCharacters = newCharacters.map(char => ({
        imageUrl: char.imageUrl !== undefined ? char.imageUrl : null,
        ...char
    }));
    setCharacters(ensuredNewCharacters);

    if (selectedCharacterForTraining && !ensuredNewCharacters.find(c => c.id === selectedCharacterForTraining.id)) {
      setSelectedCharacterForTraining(ensuredNewCharacters.find(c => c.id === 'default_training_char') || (ensuredNewCharacters.length > 0 ? ensuredNewCharacters[0] : null));
    }
    if (characterForAssistant && !ensuredNewCharacters.find(c => c.id === characterForAssistant.id)) {
      setCharacterForAssistant(ensuredNewCharacters.find(c => c.id === 'default_assistant_char') || (ensuredNewCharacters.length > 0 ? ensuredNewCharacters[0] : null));
    }
    if (!selectedCharacterForTraining && ensuredNewCharacters.length > 0) {
        setSelectedCharacterForTraining(ensuredNewCharacters.find(c => c.id === 'default_training_char') || ensuredNewCharacters[0]);
    }
    if (!characterForAssistant && ensuredNewCharacters.length > 0) {
        setCharacterForAssistant(ensuredNewCharacters.find(c => c.id === 'default_assistant_char') || ensuredNewCharacters[0]);
    }
  };

  const handleStartTraining = (character) => {
    setSelectedCharacterForTraining(character);
    setActiveView('training');
  };

  const handleStartAssistantWithCharacter = (character) => {
    setCharacterForAssistant(character);
    setActiveView('assistant');
  };

  const handleSelectView = (view) => {
    if (view === 'training' && !selectedCharacterForTraining) {
        const charToSelect = characters.find(c => c.id === 'default_training_char') || (characters.length > 0 ? characters[0] : null);
        if (charToSelect) {
            setSelectedCharacterForTraining(charToSelect);
        } else {
            alert("角色館中沒有角色可供訓練。請先新增角色。");
            setActiveView('characters');
            return;
        }
    }
    if (view === 'assistant' && !characterForAssistant) {
        const charToSelect = characters.find(c => c.id === 'default_assistant_char') || (characters.length > 0 ? characters[0] : null);
        if (charToSelect) {
            setCharacterForAssistant(charToSelect);
        }
    }
    setActiveView(view);
  };

  const renderView = () => {
    switch (activeView) {
      case 'assistant':
        return <ChatAssistant interactingWithCharacter={characterForAssistant} />;
      case 'characters':
        return <CharacterHall
                  characters={characters}
                  onUpdateCharacters={handleUpdateCharacters}
                  onStartTraining={handleStartTraining}
                  onStartAssistantWithCharacter={handleStartAssistantWithCharacter}
                />;
      case 'feedback':
        return <FeedbackWall />;
      case 'training':
      default:
         if (!selectedCharacterForTraining) {
             if (characters.length > 0) {
                // This attempts to set a default character if none is selected when trying to view 'training'.
                // This can happen if the localStorage value for LAST_TRAINING_CHAR_ID_KEY points to a deleted character.
                const defaultChar = characters.find(c => c.id === 'default_training_char') || characters[0];
                if (defaultChar) {
                    // Avoid direct setState in render by queueing it.
                    // Better: ensure selectedCharacterForTraining is always valid via useEffect or initial state.
                    // For now, this is a quick "nudge".
                    setTimeout(() => {
                        if (!selectedCharacterForTraining) { // Double check to avoid race condition if already set
                            setSelectedCharacterForTraining(defaultChar);
                        }
                    }, 0);
                    return (
                        <Container className="mt-4 text-center">
                            <p>正在加載預設訓練角色...</p>
                        </Container>
                    );
                }
            }
            // If still no character (e.g., characters array is empty)
            return (
                <Container className="mt-4 text-center">
                    <p>沒有可用的訓練角色。請先到「角色館」新增或選擇角色。</p>
                    <Button onClick={() => setActiveView('characters')}>前往角色館</Button>
                </Container>
            );
        }
        return <TrainingRoom selectedCharacter={selectedCharacterForTraining} />;
    }
  };

  return (
    <div className="app-container">
      <AppNavbar onSelectView={handleSelectView} currentView={activeView} />
      <Container fluid className="main-content mt-3">
        {renderView()}
      </Container>
    </div>
  );
}

export default App;