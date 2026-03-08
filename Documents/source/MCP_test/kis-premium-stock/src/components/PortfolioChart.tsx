import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import styles from './PortfolioChart.module.css';

interface PortfolioChartProps {
    balance: any;
}

const COLORS = ['#4361ee', '#f72585', '#3a0ca3', '#7209b7', '#4cc9f0', '#ffde2a', '#00b4d8'];

export default function PortfolioChart({ balance }: PortfolioChartProps) {
    // Parsing real data from output1 
    const data = useMemo(() => {
        if (!balance || !balance.output1 || balance.output1.length === 0) {
            return [];
        }

        // output1: Array of individual stock holdings
        // prdt_name: item name, evlu_amt: item evaluation amount
        return balance.output1
            .filter((item: any) => Number(item.evlu_amt) > 0)
            .map((item: any) => ({
                name: item.prdt_name || item.pdno || 'Unknown',
                value: Number(item.evlu_amt),
                pnlRt: item.evlu_pfls_rt,
            }))
            .sort((a: any, b: any) => b.value - a.value); // Sort by largest holding
    }, [balance]);

    if (data.length === 0) {
        return (
            <div className={styles.emptyState}>
                보유 주식이 없거나 잔고 데이터를 불러올 수 없습니다.
            </div>
        );
    }

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const dataInfo = payload[0].payload;
            const isUp = Number(dataInfo.pnlRt) > 0;
            const isDown = Number(dataInfo.pnlRt) < 0;

            return (
                <div className={styles.customTooltip}>
                    <p className={styles.tooltipTitle}>{dataInfo.name}</p>
                    <p className={styles.tooltipValue}>
                        평가액: {dataInfo.value.toLocaleString('ko-KR')}원
                    </p>
                    <p className={`${styles.tooltipRate} ${isUp ? styles.up : isDown ? styles.down : ''}`}>
                        수익률: {dataInfo.pnlRt}%
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className={styles.chartContainer}>
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius="55%"
                        outerRadius="80%"
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                    >
                        {data.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
}
