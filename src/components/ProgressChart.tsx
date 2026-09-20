import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  Cell
} from 'recharts';
import { GameSession } from '../types';

interface ProgressChartProps {
  sessions: GameSession[];
  categoryScores: {
    memory: number;
    attention: number;
    recall: number;
    recognition: number;
  };
}

export const ProgressChart: React.FC<ProgressChartProps> = ({ sessions, categoryScores }) => {
  // Prepare category data
  const categoryData = [
    { name: 'Memory', score: categoryScores.memory, color: '#176B61' },
    { name: 'Attention', score: categoryScores.attention, color: '#7FAFA5' },
    { name: 'Recall', score: categoryScores.recall, color: '#A2A1CD' },
    { name: 'Recognition', score: categoryScores.recognition, color: '#CD9C8A' },
  ];

  // Prepare accuracy trend data (last 7 sessions sorted chronologically)
  const trendData = [...sessions]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .slice(-7)
    .map(s => ({
      date: new Date(s.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      accuracy: s.accuracy,
      score: s.score,
      game: s.gameTitle,
    }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Category Performance Bar Chart */}
      <div className="bg-white p-5 rounded-3xl border border-[#E4DED4] shadow-xs">
        <h4 className="text-base font-extrabold text-[#26332F] mb-1">Activity Performance by Category</h4>
        <p className="text-xs text-[#66736D] mb-4">Percentage score across cognitive activity domains</p>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categoryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4DED4" />
              <XAxis dataKey="name" tickLine={false} axisLine={{ stroke: '#E4DED4' }} tick={{ fill: '#66736D', fontSize: 12 }} />
              <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: '#66736D', fontSize: 12 }} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: '1px solid #E4DED4', backgroundColor: '#FFFFFF', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
                formatter={(value: any) => [`${value}%`, 'Score']}
              />
              <Bar dataKey="score" radius={[8, 8, 0, 0]}>
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Accuracy Trend Line Chart */}
      <div className="bg-white p-5 rounded-3xl border border-[#E4DED4] shadow-xs">
        <h4 className="text-base font-extrabold text-[#26332F] mb-1">Accuracy Progression Trend</h4>
        <p className="text-xs text-[#66736D] mb-4">Historical accuracy % over recent completed sessions</p>
        {trendData.length === 0 ? (
          <div className="h-64 w-full flex flex-col items-center justify-center text-center p-4">
            <p className="text-sm font-bold text-[#66736D]">No activity trend data recorded yet.</p>
            <p className="text-xs text-[#A3A1AC] mt-1">Scores will appear automatically as the patient completes cognitive activities.</p>
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4DED4" />
                <XAxis dataKey="date" tickLine={false} axisLine={{ stroke: '#E4DED4' }} tick={{ fill: '#66736D', fontSize: 12 }} />
                <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: '#66736D', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: '1px solid #E4DED4', backgroundColor: '#FFFFFF', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
                  formatter={(value: any, name: any, props: any) => [`${value}% Accuracy (${props.payload.game})`]}
                />
                <Line
                  type="monotone"
                  dataKey="accuracy"
                  stroke="#176B61"
                  strokeWidth={3}
                  dot={{ r: 5, fill: '#176B61', strokeWidth: 2, stroke: '#ffffff' }}
                  activeDot={{ r: 8 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};
