import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import styles from './PortfolioChart.module.css';

interface PortfolioChartProps {
    balance: any;
    overseasBalance?: any;
}

const DOMESTIC_COLORS = [
    '#4361ee', // 메인 블루
    '#3a0ca3', // 딥 퍼플
    '#7209b7', // 바이올렛
    '#b5179e', // 마젠타
    '#4cc9f0', // 스카이 블루
    '#560bad', // 로얄 퍼플
    '#4895ef', // 라이트 블루
    '#3f37c9'  // 인디고
];

const OVERSEAS_COLORS = [
    '#ffde2a', // 브라이트 옐로우
    '#4ade80', // 네온 그린
    '#f72585', // 핫 핑크
    '#fb8500', // 오렌지
    '#2ec4b6', // 틸
    '#ff9f1c', // 선셋 오렌지
    '#00f5d4', // 터쿼이즈
    '#fee440'  // 레몬
];

export default function PortfolioChart({ balance, overseasBalance }: PortfolioChartProps) {
    // Parsing real data from domestic and overseas output1
    // 1. Domestic Stocks Data
    const domesticData = useMemo(() => {
        const result: any[] = [];
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
        return result.sort((a, b) => b.value - a.value);
    }, [balance]);

    // 2. Overseas Stocks Data
    const overseasData = useMemo(() => {
        const result: any[] = [];
        if (overseasBalance?.output1 && Array.isArray(overseasBalance.output1)) {
            overseasBalance.output1.forEach((item: any) => {
                let evalAmt = Number(item.evlu_amt_smtl || item.evlu_amt || 0);
                const evalUSD = Number(item.ovrs_stck_evlu_amt || 0);

                if (evalAmt === 0 && evalUSD > 0) {
                    evalAmt = evalUSD * 1400;
                }

                if (evalAmt > 0) {
                    result.push({
                        name: item.ovrs_item_name || item.ovrs_pdno || 'Unknown',
                        value: evalAmt,
                        valueUSD: evalUSD,
                        pnlRt: item.evlu_pfls_rt || '0.00',
                        type: 'Overseas'
                    });
                }
            });
        }
        return result.sort((a, b) => b.value - a.value);
    }, [overseasBalance]);

    if (domesticData.length === 0 && overseasData.length === 0) {
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
        <div className={styles.multiChartWrapper}>
            {/* Domestic Chart */}
            <div className={styles.chartBox}>
                <h4 className={styles.chartTitle}>국내 주식 비중</h4>
                {domesticData.length > 0 ? (
                    <div className={styles.chartContainer}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={domesticData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius="50%"
                                    outerRadius="75%"
                                    paddingAngle={3}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {domesticData.map((entry: any, index: number) => (
                                        <Cell
                                            key={`cell-dom-${index}`}
                                            fill={DOMESTIC_COLORS[index % DOMESTIC_COLORS.length]}
                                            stroke="rgba(255,255,255,0.1)"
                                            strokeWidth={1}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className={styles.smallEmpty}>국내 보유 종목이 없습니다.</div>
                )}
            </div>

            {/* Overseas Chart */}
            <div className={styles.chartBox}>
                <h4 className={styles.chartTitle}>해외 주식 비중</h4>
                {overseasData.length > 0 ? (
                    <div className={styles.chartContainer}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={overseasData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius="50%"
                                    outerRadius="75%"
                                    paddingAngle={3}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {overseasData.map((entry: any, index: number) => (
                                        <Cell
                                            key={`cell-ovs-${index}`}
                                            fill={OVERSEAS_COLORS[index % OVERSEAS_COLORS.length]}
                                            stroke="rgba(255,255,255,0.1)"
                                            strokeWidth={1}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className={styles.smallEmpty}>해외 보유 종목이 없습니다.</div>
                )}
            </div>
        </div>
    );
}
