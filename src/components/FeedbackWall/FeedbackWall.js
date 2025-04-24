import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Alert } from 'react-bootstrap';
import FeedbackChart from './FeedbackChart';

// 假設回饋數據的結構
// interface FeedbackData {
//   timestamp: number;
//   goal: string;
//   characterId: string;
//   characterName: string;
//   scores: { // 不同面向的分數 (0-100)
//     clarity: number; // 清晰度
//     empathy: number; // 同理心
//     confidence: number; // 自信
//     appropriateness: number; // 適當性
//     goalAchievement: number; // 目標達成度
//   };
//   summary: string; // AI 總結
// }

// 本地儲存回饋的 Key
const FEEDBACK_STORAGE_KEY = 'wingchat_feedback';

function FeedbackWall({ /* chatHistory potentially passed for analysis */ }) {
  const [feedbackHistory, setFeedbackHistory] = useState([]);

  // 從 localStorage 加載回饋數據 (假設 handleGetFeedback 會儲存)
  useEffect(() => {
    const savedFeedback = localStorage.getItem(FEEDBACK_STORAGE_KEY);
    if (savedFeedback) {
      try {
        const parsedFeedback = JSON.parse(savedFeedback);
        // 按時間戳降序排序
        parsedFeedback.sort((a, b) => b.timestamp - a.timestamp);
        setFeedbackHistory(parsedFeedback);
      } catch (e) {
        console.error("Failed to parse feedback history", e);
        setFeedbackHistory([]);
      }
    }
    // 這裡僅是範例，實際應用中，數據來源可能是 handleGetFeedback 函數調用後更新 localStorage
    // 你需要在 handleGetFeedback 成功獲取回饋後，將數據保存到 localStorage
    // 例如:
    // const newFeedback = { timestamp: Date.now(), goal, characterId: selectedCharacter.id, ... };
    // const existingFeedback = JSON.parse(localStorage.getItem(FEEDBACK_STORAGE_KEY) || '[]');
    // localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify([...existingFeedback, newFeedback]));
    // // 然後可能需要觸發 FeedbackWall 重新加載數據
  }, []); // 空依賴數組，僅在組件加載時運行一次

  // 準備 Chart.js 的數據 (只顯示最近 N 次的回饋趨勢)
  const chartLabels = feedbackHistory.slice(0, 5).reverse().map(fb => new Date(fb.timestamp).toLocaleDateString()); // 最近 5 次的日期
  const chartDataSets = [
    {
      label: '清晰度',
      data: feedbackHistory.slice(0, 5).reverse().map(fb => fb.scores?.clarity ?? 0),
      backgroundColor: 'rgba(54, 162, 235, 0.6)', // Blue
      borderColor: 'rgba(54, 162, 235, 1)',
      borderWidth: 1,
    },
    {
      label: '同理心',
      data: feedbackHistory.slice(0, 5).reverse().map(fb => fb.scores?.empathy ?? 0),
      backgroundColor: 'rgba(255, 206, 86, 0.6)', // Yellow
      borderColor: 'rgba(255, 206, 86, 1)',
      borderWidth: 1,
    },
    {
        label: '自信',
        data: feedbackHistory.slice(0, 5).reverse().map(fb => fb.scores?.confidence ?? 0),
        backgroundColor: 'rgba(75, 192, 192, 0.6)', // Green
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1,
    },
     {
        label: '適當性',
        data: feedbackHistory.slice(0, 5).reverse().map(fb => fb.scores?.appropriateness ?? 0),
        backgroundColor: 'rgba(153, 102, 255, 0.6)', // Purple
        borderColor: 'rgba(153, 102, 255, 1)',
        borderWidth: 1,
      },
      {
        label: '目標達成',
        data: feedbackHistory.slice(0, 5).reverse().map(fb => fb.scores?.goalAchievement ?? 0),
        backgroundColor: 'rgba(255, 99, 132, 0.6)', // Red
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 1,
       },
  ];

  return (
    <Container>
      <h2 className="mb-4">回饋牆</h2>
      <p className="text-muted mb-4">這裡匯總了你每次請求 AI 回饋的結果，觀察你的進步趨勢吧！</p>

       {/* --- 進步趨勢圖表 --- */}
      <Card className="mb-4 shadow-sm">
          <Card.Header>最近 5 次練習表現趨勢</Card.Header>
          <Card.Body>
              {feedbackHistory.length > 0 ? (
                   <FeedbackChart labels={chartLabels} datasets={chartDataSets} />
              ) : (
                   <Alert variant="light" className="text-center">
                       還沒有足夠的回饋數據來顯示趨勢圖。在訓練室完成對話後，試試點擊「我說得如何？」按鈕吧！
                   </Alert>
              )}
          </Card.Body>
      </Card>

      {/* --- 歷史回饋列表 --- */}
      <h3 className="h5 mb-3">歷史回饋記錄</h3>
      {feedbackHistory.length > 0 ? (
        feedbackHistory.map((fb) => (
          <Card key={fb.timestamp} className="mb-3 shadow-sm">
            <Card.Header className="d-flex justify-content-between small text-muted">
              <span>{new Date(fb.timestamp).toLocaleString()}</span>
              <span>角色: {fb.characterName || '未知'} / 目標: {fb.goal || '未知'}</span>
            </Card.Header>
            <Card.Body>
              <Card.Subtitle className="mb-2 text-muted small">AI 總結:</Card.Subtitle>
              <Card.Text style={{ whiteSpace: 'pre-wrap' }}>{fb.summary || '沒有提供總結。'}</Card.Text>
              {/* 可以選擇性顯示分數細節 */}
              {/*
              <hr />
              <p className="small">分數細節: 清晰度({fb.scores?.clarity}), 同理心({fb.scores?.empathy}), ...</p>
              */}
            </Card.Body>
          </Card>
        ))
      ) : (
        <Alert variant="secondary" className="text-center">
          還沒有任何回饋記錄。
        </Alert>
      )}
    </Container>
  );
}

export default FeedbackWall;