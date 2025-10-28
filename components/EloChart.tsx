import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import type { EloHistoryPoint } from '../types';

interface EloChartProps {
  data: EloHistoryPoint[];
  teamColor: string;
  overallBaseline?: number;
  confBaseline?: number;
}

const EloChart: React.FC<EloChartProps> = ({ data, teamColor, overallBaseline, confBaseline }) => {
    
    // Format date for display on X-axis
    const formatDate = (tickItem: string) => {
        const date = new Date(tickItem);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    if (!data || data.length === 0) {
        return <div className="flex items-center justify-center h-full text-gray-500">No ELO data available.</div>;
    }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart 
        data={data}
        margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
        >
        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" strokeOpacity={0.1} />
        <XAxis 
            dataKey="date" 
            tickFormatter={formatDate}
            tick={{ fill: '#a1a1aa', fontSize: 12 }}
            axisLine={{ stroke: '#ffffff', strokeOpacity: 0.2 }}
            tickLine={{ stroke: '#ffffff', strokeOpacity: 0.2 }}
            interval="preserveStartEnd"
            minTickGap={20}
        />
        <YAxis 
            domain={['dataMin - 10', 'dataMax + 10']}
            tick={{ fill: '#a1a1aa', fontSize: 12 }}
            axisLine={{ stroke: '#ffffff', strokeOpacity: 0.2 }}
            tickLine={{ stroke: '#ffffff', strokeOpacity: 0.2 }}
        />
        <Tooltip 
            contentStyle={{ 
                backgroundColor: 'rgba(10, 10, 10, 0.7)',
                backdropFilter: 'blur(10px)',
                borderColor: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '0.75rem',
            }}
            labelStyle={{ color: '#f3f4f6', fontWeight: 'bold' }}
            itemStyle={{ color: teamColor }}
            labelFormatter={formatDate}
        />
        {overallBaseline !== undefined && (
          <ReferenceLine y={overallBaseline} stroke="#d1d5db" strokeDasharray="4 4" />
        )}
        {confBaseline !== undefined && (
          <ReferenceLine y={confBaseline} stroke="#60a5fa" strokeDasharray="4 4" />
        )}
        <Line 
            type="monotone" 
            dataKey="elo" 
            stroke={teamColor} 
            strokeWidth={3}
            strokeOpacity={0.95}
            dot={false}
            isAnimationActive
            animationDuration={500}
            activeDot={{ r: 6, fill: teamColor, stroke: '#fff', strokeWidth: 2 }}
            style={{ filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.2))' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default EloChart;
