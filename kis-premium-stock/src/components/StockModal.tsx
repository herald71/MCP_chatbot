"use client";

import { useEffect, useState } from 'react';
import styles from './StockModal.module.css';

interface StockModalProps {
    isOpen: boolean;
    onClose: () => void;
    stockCode: string;
    stockName: string;
}

export default function StockModal({ isOpen, onClose, stockCode, stockName }: StockModalProps) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen && stockCode) {
            setLoading(true);
            fetch(`/api/kis/price?code=${stockCode}`)
                .then(res => res.json())
                .then(json => {
                    setData(json?.output);
                })
                .finally(() => setLoading(false));
        }
    }, [isOpen, stockCode]);

    if (!isOpen) return null;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <button className={styles.closeBtn} onClick={onClose}>✕</button>

                <div className={styles.header}>
                    <h2 className={styles.stockName}>{stockName}</h2>
                    <span className={styles.stockCode}>{stockCode}</span>
                </div>

                {loading ? (
                    <div className={styles.loading}>데이터를 불러오는 중입니다...</div>
                ) : data ? (
                    <div className={styles.content}>
                        <div className={styles.priceHero}>
                            <div className={styles.currentPrice}>
                                {Number(data.stck_prpr).toLocaleString('ko-KR')} <span>원</span>
                            </div>
                            <div className={`${styles.change} ${Number(data.prdy_ctrt) > 0 ? styles.up : styles.down}`}>
                                {Number(data.prdy_ctrt) > 0 ? '▲' : '▼'} {data.prdy_vrss} ({data.prdy_ctrt}%)
                            </div>
                        </div>

                        <div className={styles.detailsGrid}>
                            <div className={styles.detailItem}>
                                <span>시가</span>
                                <strong>{Number(data.stck_oprc).toLocaleString('ko-KR')}</strong>
                            </div>
                            <div className={styles.detailItem}>
                                <span>고가</span>
                                <strong className={styles.up}>{Number(data.stck_hgpr).toLocaleString('ko-KR')}</strong>
                            </div>
                            <div className={styles.detailItem}>
                                <span>저가</span>
                                <strong className={styles.down}>{Number(data.stck_lwpr).toLocaleString('ko-KR')}</strong>
                            </div>
                            <div className={styles.detailItem}>
                                <span>누적 거래량</span>
                                <strong>{Number(data.acml_vol).toLocaleString('ko-KR')}</strong>
                            </div>
                        </div>

                        <button className={styles.actionBtn}>이 종목 매매하기</button>
                    </div>
                ) : (
                    <div className={styles.error}>데이터를 불러올 수 없습니다.</div>
                )}
            </div>
        </div>
    );
}
