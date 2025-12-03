import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ProgressPoint } from '../services/storageService';

interface ExerciseProgressChartProps {
    data: ProgressPoint[];
    title?: string;
    color?: string;
}

export const ExerciseProgressChart: React.FC<ExerciseProgressChartProps> = ({ data, title, color = "#3b82f6" }) => {
    if (!data || data.length < 2) {
        return (
            <div className="flex items-center justify-center h-48 bg-slate-900/50 rounded-xl border border-slate-800 text-slate-500 text-sm p-4 text-center">
                {data.length === 0 ? "Nessun dato storico disponibile." : "Dati insufficienti per un grafico (serve almeno 2 sessioni)."}
            </div>
        );
    }

    return (
        <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 w-full">
            {title && <h3 className="text-white font-semibold mb-4">{title}</h3>}
            <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis 
                            dataKey="date" 
                            stroke="#64748b" 
                            fontSize={12} 
                            tickLine={false} 
                            axisLine={false}
                            tickMargin={10}
                        />
                        <YAxis 
                            stroke="#64748b" 
                            fontSize={12} 
                            tickLine={false} 
                            axisLine={false}
                            width={35}
                        />
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', color: '#fff' }}
                            itemStyle={{ color: color }}
                            labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                            formatter={(value: number) => [`${value} kg`, 'Carico']}
                        />
                        <Line 
                            type="monotone" 
                            dataKey="weight" 
                            stroke={color} 
                            strokeWidth={3} 
                            dot={{ r: 4, fill: color, strokeWidth: 2, stroke: '#0f172a' }}
                            activeDot={{ r: 6, fill: '#60a5fa' }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
