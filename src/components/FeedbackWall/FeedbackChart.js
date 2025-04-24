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

// 註冊 Chart.js 需要的元件
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

function FeedbackChart({ labels, datasets }) {
  const data = {
    labels: labels, // X 軸標籤 (日期或次數)
    datasets: datasets, // Y 軸數據集 (不同評分面向)
  };

  const options = {
    responsive: true, // 響應式圖表
    maintainAspectRatio: false, // 允許高度自訂
    plugins: {
      legend: {
        position: 'top', // 圖例位置
      },
      title: {
        display: true,
        text: '社交技能評分趨勢 (0-100分)', // 圖表標題
      },
      tooltip: {
         mode: 'index', // 顯示同一索引下的所有數據點
         intersect: false,
      }
    },
    scales: {
      y: {
        beginAtZero: true, // Y 軸從 0 開始
        max: 100, // Y 軸最大值 100
        title: {
           display: true,
           text: '分數'
        }
      },
      x: {
         title: {
            display: true,
            text: '練習時間'
         }
      }
    },
    interaction: { // 交互模式
      mode: 'index',
      intersect: false,
    },
  };

  // 給圖表一個最小高度，避免數據少時過扁
  return (
    <div style={{ position: 'relative', height: '300px', width: '100%' }}>
       <Bar options={options} data={data} />
    </div>
   );
}

export default FeedbackChart;