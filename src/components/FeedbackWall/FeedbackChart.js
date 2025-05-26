// src/components/Feedback/FeedbackChart.js (假設路徑)
import React from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register( CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend );

function FeedbackChart({ labels, datasets, chartTitle = '社交技能評分趨勢 (0-100分)' }) { // 添加可選的 chartTitle prop
  const data = {
    labels: labels,
    datasets: datasets,
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: chartTitle }, // 使用 prop
      tooltip: { mode: 'index', intersect: false }
    },
    scales: {
      y: { beginAtZero: true, max: 100, title: { display: true, text: '分數' }},
      x: { title: { display: true, text: '練習時間' }}
    },
    interaction: { mode: 'index', intersect: false },
  };

  return (
    <div style={{ position: 'relative', height: '350px', width: '100%' }}> {/* 稍微增加高度 */}
       <Bar options={options} data={data} />
    </div>
   );
}

export default FeedbackChart;