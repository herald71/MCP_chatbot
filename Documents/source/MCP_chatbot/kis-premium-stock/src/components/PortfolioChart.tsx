import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import styles from './PortfolioChart.module.css';

interface PortfolioChartProps {
    balance: any;
    overseasBalance?: any;
}

const COLORS = ['#4361ee', '#f72585', '#3a0ca3', '#7209b7', '#4cc9f0', '#ffde2a', '#00b4d8', '#00d2ff', '#4ade80'];

export default function PortfolioChart({ balance, overseasBalance }: PortfolioChartProps) {
    // Parsing real data from domestic and overseas output1
    const data = useMemo(() => {
        const result: any[] = [];

        // 1. Domestic Stocks
        if (balance?.output1 && Array.isArray(balance.output1)) {
            balance.output1.forEach((item: any) => {
                const evalAmt = Number(item.evlu_amt || 0);
                if (evalAmt > 0) {
                    result.push({
                        name: item.prdt_name || item.pdno || 'Unknown',
                        value: evalAmt,
                        pnlRt: item.evlu_pfls_rt || '0.00',
                        type: 'Domestic'
                    });
                }
            });
        }

        // 2. Overseas Stocks
        if (overseasBalance?.output1 && Array.isArray(overseasBalance.output1)) {
            overseasBalance.output1.forEach((item: any) => {
                // Overseas evaluation amount (KRW) usually in evlu_amt_smtl
                const evalAmt = Number(item.evlu_amt_smtl || item.evlu_amt || 0);
                const evalUSD = Number(item.ovrs_cblc_evlu_amt || 0);

                // Even if KRW eval is 0 (demo acc issues), if we have USD, let's show it
                if (evalAmt > 0 || evalUSD > 0) {
                    result.push({
                        name: item.ovrs_item_name || item.ovrs_pdno || 'Unknown',
                        value: evalAmt, // For chart slice size
                        valueUSD: evalUSD, // For tooltip
                        pnlRt: item.evlu_pfls_rt || item.evlu_pfls_rt1 || '0.00',
                        type: 'Overseas'
                    });
                }
            });
        }

        return result.sort((a: any, b: any) => (b.value || 0) - (a.value || 0)); // Sort by largest holding
    }, [balance, overseasBalance]);

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
                        평가액: {dataInfo.type === 'Domestic'
                            ? `${dataInfo.value.toLocaleString('ko-KR')}원`
                            : `$${(dataInfo.valueUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        }
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
