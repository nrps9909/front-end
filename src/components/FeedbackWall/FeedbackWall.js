// src/components/Feedback/FeedbackWall.js
import React, { useState, useEffect, useCallback } from 'react';
import { Container, Card, Alert } from 'react-bootstrap';
import FeedbackChart from './FeedbackChart';

const FEEDBACK_STORAGE_KEY = 'wingchat_feedback';

// These are USER social skill evaluation items, used for the chart
// The backend /api/feedback will now be prompted to provide scores for these based on user's performance
export const USER_SOCIAL_SKILL_CHART_CONFIG = [ // Export for TrainingRoom to use for labels
  { key: 'clarity', label: '表達清晰度', color: 'rgba(54, 162, 235, 0.7)', borderColor: 'rgba(54, 162, 235, 1)' },
  { key: 'empathy', label: '同理心展現', color: 'rgba(255, 206, 86, 0.7)', borderColor: 'rgba(255, 206, 86, 1)' },
  { key: 'confidence', label: '自信程度', color: 'rgba(75, 192, 192, 0.7)', borderColor: 'rgba(75, 192, 192, 1)' },
  { key: 'appropriateness', label: '言談適當性', color: 'rgba(153, 102, 255, 0.7)', borderColor: 'rgba(153, 102, 255, 1)' },
  { key: 'goalAchievement', label: '目標達成技巧', color: 'rgba(255, 99, 132, 0.7)', borderColor: 'rgba(255, 99, 132, 1)' },
];

function FeedbackWall() {
  const [feedbackHistory, setFeedbackHistory] = useState([]);
  const [error, setError] = useState(null);

  const loadFeedbackHistory = useCallback(() => {
    try {
      const savedFeedback = localStorage.getItem(FEEDBACK_STORAGE_KEY);
      if (savedFeedback) {
        const parsedFeedback = JSON.parse(savedFeedback);
        if (Array.isArray(parsedFeedback)) {
          // Ensure scores are valid numbers or null for the chart
          const validatedFeedback = parsedFeedback.map(fb => ({
            ...fb,
            scores: fb.scores ? Object.fromEntries(
                Object.entries(fb.scores).map(([key, value]) => [key, typeof value === 'number' ? value : null])
            ) : {}
          })).sort((a, b) => b.timestamp - a.timestamp);
          setFeedbackHistory(validatedFeedback);
        } else {
          setFeedbackHistory([]);
          setError("儲存的回饋數據格式不正確。");
        }
      } else { setFeedbackHistory([]); }
    } catch (e) {
      console.error("Failed to parse feedback history", e);
      setFeedbackHistory([]);
      setError(`加載回饋歷史失敗: ${e.message}`);
    }
  }, []);

  useEffect(() => {
    loadFeedbackHistory();
    const handleStorageChange = (event) => {
        if (event.key === FEEDBACK_STORAGE_KEY) {
            loadFeedbackHistory();
        }
    };
    // Listen for direct storage changes (e.g. other tabs)
    window.addEventListener('storage', handleStorageChange);
    
    // Listen for custom event (e.g. same tab, immediate update)
    // document.addEventListener('newFeedbackSaved', loadFeedbackHistory); 
    
    return () => {
        window.removeEventListener('storage', handleStorageChange);
        // document.removeEventListener('newFeedbackSaved', loadFeedbackHistory);
    };
  }, [loadFeedbackHistory]);

  const MAX_CHART_ITEMS = 10; // Can show more items
  const recentFeedbackForChart = feedbackHistory.slice(0, MAX_CHART_ITEMS).reverse();

  const chartLabels = recentFeedbackForChart.map(fb =>
    fb.timestamp ? new Date(fb.timestamp).toLocaleDateString() : '未知日期'
  );

  const chartDataSets = USER_SOCIAL_SKILL_CHART_CONFIG.map(item => ({
    label: item.label,
    data: recentFeedbackForChart.map(fb => (fb.scores && typeof fb.scores[item.key] === 'number') ? fb.scores[item.key] : null),
    backgroundColor: item.color,
    borderColor: item.borderColor,
    borderWidth: 1,
    tension: 0.1,
  }));

  return (
    <Container className="my-4">
      <h2 className="mb-4">回饋牆</h2>
      <p className="text-muted mb-4">這裡匯總了 AI 對您每次訓練室練習表現的回饋，觀察您的進步趨勢吧！</p>

      {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}

      <Card className="mb-4 shadow-sm">
          <Card.Header as="h5">最近 {MAX_CHART_ITEMS} 次練習社交技能表現趨勢</Card.Header>
          <Card.Body>
              {recentFeedbackForChart.length > 0 ? (
                   <FeedbackChart
                       labels={chartLabels}
                       datasets={chartDataSets}
                       chartTitle={`最近 ${recentFeedbackForChart.length} 次練習社交技能評分趨勢`} // Prop used by FeedbackChart
                   />
              ) : (
                   <Alert variant="light" className="text-center py-3">
                       {feedbackHistory.length === 0
                           ? "還沒有任何回饋記錄。在訓練室完成對話後，試試點擊「我表現如何？」按鈕吧！"
                           : "還沒有足夠的回饋數據來顯示趨勢圖 (至少需要一筆)。"
                       }
                   </Alert>
              )}
          </Card.Body>
      </Card>

      <h3 className="h5 mb-3">您的歷史回饋記錄</h3>
      {feedbackHistory.length > 0 ? (
        feedbackHistory.map((fb, index) => (
          <Card key={fb.id || fb.timestamp || `feedback-${index}`} className="mb-3 shadow-sm">
            <Card.Header className="d-flex justify-content-between flex-wrap small text-muted">
              <span>{fb.timestamp ? new Date(fb.timestamp).toLocaleString() : '未知時間'}</span>
              <span className="text-truncate" style={{ maxWidth: '60%' }}>
                角色: {fb.characterName || '未知'} / 目標: {fb.goal || '未知'}
              </span>
            </Card.Header>
            <Card.Body>
              <Card.Subtitle className="mb-2 text-muted small">AI 對您本次練習表現的總結：</Card.Subtitle>
              <Card.Text style={{ whiteSpace: 'pre-wrap', maxHeight: '100px', overflowY: 'auto' }}>
                {fb.summary || (fb.userEvaluationDetails?.summary) || '沒有提供總結。'}
              </Card.Text>

              {/* Display user's social skill scores (source for the chart) */}
              {fb.scores && USER_SOCIAL_SKILL_CHART_CONFIG.some(item => fb.scores[item.key] !== undefined && fb.scores[item.key] !== null) && (
                <>
                  <hr />
                  <p className="small mb-1"><strong>您的社交技能評分:</strong></p>
                  <ul className="list-unstyled small">
                    {USER_SOCIAL_SKILL_CHART_CONFIG.map(item =>
                      (fb.scores && fb.scores[item.key] !== undefined && fb.scores[item.key] !== null) ? (
                        <li key={item.key}>
                          {item.label}: {fb.scores[item.key]}
                          {fb.userEvaluationDetails?.scores?.[item.key]?.justification && ` (理由: ${fb.userEvaluationDetails.scores[item.key].justification})`}
                        </li>
                      ) : null
                    )}
                  </ul>
                </>
              )}

              {/* Display detailed evaluation of the USER (strengths, improvements) */}
              {fb.userEvaluationDetails && (
                <>
                  {(fb.userEvaluationDetails.strengths && fb.userEvaluationDetails.strengths.length > 0) ||
                   (fb.userEvaluationDetails.improvements && fb.userEvaluationDetails.improvements.length > 0) ? <hr /> : null}

                  {fb.userEvaluationDetails.strengths && fb.userEvaluationDetails.strengths.length > 0 && (
                    <>
                      <p className="small mb-1"><strong>您的優點:</strong></p>
                      <ul className="list-unstyled small">
                        {fb.userEvaluationDetails.strengths.map((s, i) => <li key={`user-strength-${index}-${i}`}>- {s}</li>)}
                      </ul>
                    </>
                  )}
                  {fb.userEvaluationDetails.improvements && fb.userEvaluationDetails.improvements.length > 0 && (
                    <>
                      <p className="small mb-1"><strong>給您的改進建議:</strong></p>
                      <ul className="list-unstyled small">
                        {fb.userEvaluationDetails.improvements.map((imp, i) => <li key={`user-improvement-${index}-${i}`}>- {imp}</li>)}
                      </ul>
                    </>
                  )}
                </>
              )}
            </Card.Body>
          </Card>
        ))
      ) : (
        <Alert variant="info" className="text-center py-3">
          還沒有任何回饋記錄。去訓練室練習並獲取 AI 對您表現的回饋吧！
        </Alert>
      )}
    </Container>
  );
}

export default FeedbackWall;