"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";

interface StockRank {
    mksc_shrn_iscd: string; // 종목코드
    hts_kor_isnm: string;   // 종목명
    stck_prpr: string;      // 현재가
    prdy_vrss_sign: string; // 전일 대비 부호
    prdy_ctrt: string;      // 전일 대비율
    acml_vol: string;       // 누적 거래량
}

export default function QuantLab() {
    const [loading, setLoading] = useState(true);
    const [ranks, setRanks] = useState<StockRank[]>([]);
    const [errorMSG, setErrorMSG] = useState("");

    useEffect(() => {
        async function fetchRanking() {
            try {
                const res = await fetch("/api/kis/ranking");
                if (!res.ok) throw new Error("데이터를 불러오지 못했습니다.");
                const data = await res.json();

                // KIS API 응답은 output 배열 형태로 옵니다.
                if (data && data.output) {
                    // 상위 15개 종목만 노출
                    setRanks(data.output.slice(0, 15));
                }
            } catch (e: any) {
                setErrorMSG(e.message);
            } finally {
                setLoading(false);
            }
        }
        fetchRanking();
    }, []);

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>Quant <span className="gradient-text">Lab</span> 🔬</h1>
                <p className={styles.subtitle}>실시간 시장의 흐름과 거래량 급등 종목을 한눈에 발굴하세요.</p>
            </header>

            <div className={`glass-panel ${styles.board}`}>
                <h3 className={styles.boardTitle}>실시간 거래량 상위 종목 TOP 15</h3>

                {loading ? (
                    <div className={styles.loading}>시장 데이터를 수집 중입니다...</div>
                ) : errorMSG ? (
                    <div className={styles.error}>{errorMSG}</div>
                ) : (
                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>순위</th>
                                    <th>종목명</th>
                                    <th>현재가</th>
                                    <th>등락률</th>
                                    <th>누적 거래량</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ranks.map((item, idx) => {
                                    const isUp = Number(item.prdy_ctrt) > 0;
                                    const isDown = Number(item.prdy_ctrt) < 0;

                                    return (
                                        <tr key={item.mksc_shrn_iscd}>
                                            <td className={styles.rankCol}>{idx + 1}</td>
                                            <td className={styles.nameCol}>
                                                <span className={styles.stockName}>{item.hts_kor_isnm}</span>
                                                <span className={styles.stockCode}>{item.mksc_shrn_iscd}</span>
                                            </td>
                                            <td className={styles.priceCol}>
                                                {Number(item.stck_prpr).toLocaleString('ko-KR')}
                                            </td>
                                            <td className={`${styles.changeCol} ${isUp ? styles.up : isDown ? styles.down : ''}`}>
                                                {isUp ? '+' : ''}{item.prdy_ctrt}%
                                            </td>
                                            <td className={styles.volCol}>
                                                {Number(item.acml_vol).toLocaleString('ko-KR')} 주
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
