"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import styles from "./page.module.css";
import PortfolioChart from "../../components/PortfolioChart";
import StockModal from "../../components/StockModal";

export default function Home() {
  const [balance, setBalance] = useState<any>(null);
  const [overseasBalance, setOverseasBalance] = useState<any>(null);
  const [marketIndices, setMarketIndices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStock, setSelectedStock] = useState<{ code: string, name: string } | null>(null);
  const [holdingPrices, setHoldingPrices] = useState<Record<string, any>>({});

  useEffect(() => {
    async function fetchBalance() {
      try {
        const [res, resOverseas, resMarket] = await Promise.all([
          fetch("/api/kis/balance"),
          fetch("/api/kis/overseas-balance"),
          fetch("/api/kis/market-indices")
        ]);

        if (res.ok) {
          const data = await res.json();
          setBalance(data);
        }

        if (resOverseas.ok) {
          const overseasData = await resOverseas.json();
          setOverseasBalance(overseasData);
        }

        if (resMarket.ok) {
          const marketData = await resMarket.json();
          setMarketIndices(marketData);
        }
      } catch (e) {
        console.error("API Call Error:", e);
      } finally {
        setLoading(false);
      }
    }

    fetchBalance();
  }, []);

  // 종목 코드 (삼성전자, SK하이닉스, 현대차)
  const watchListCodes = [
    { name: '삼성전자', code: '005930' },
    { name: 'SK하이닉스', code: '000660' },
    { name: '현대차', code: '005380' }
  ];

  const [watchPrices, setWatchPrices] = useState<any>({});
  const [flashHighlight, setFlashHighlight] = useState<Record<string, 'up' | 'down' | 'none'>>({});

  useEffect(() => {
    async function fetchWatchlist() {
      const prices: any = {};
      for (const item of watchListCodes) {
        try {
          const res = await fetch(`/api/kis/price?code=${item.code}`);
          const data = await res.json();
          prices[item.code] = data?.output;
        } catch (e) {
          console.error(`Error fetching ${item.code}`, e);
        }
      }

      setWatchPrices((prev: any) => {
        const newFlash: any = {};
        let hasChanges = false;

        for (const item of watchListCodes) {
          const oldPrice = prev[item.code]?.stck_prpr;
          const newPrice = prices[item.code]?.stck_prpr;

          if (oldPrice && newPrice && oldPrice !== newPrice) {
            newFlash[item.code] = Number(newPrice) > Number(oldPrice) ? 'up' : 'down';
            hasChanges = true;
          }
        }

        if (hasChanges) {
          setFlashHighlight(newFlash);
          setTimeout(() => setFlashHighlight({}), 1500);
        }

        return prices;
      });
    }

    fetchWatchlist();

    // 5초 간격으로 실시간 가격 폴링 (백그라운드 통신)
    const interval = setInterval(fetchWatchlist, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isPolling = useRef(false);

  // 보유 종목 실시간 가격/변동률 폴링
  useEffect(() => {
    if (!balance?.output1 && !overseasBalance?.output1) return;

    async function fetchHoldingPrices() {
      if (isPolling.current) return;
      isPolling.current = true;

      try {
        const items: { code: string, type: 'KR' | 'US', excd?: string }[] = [];

        if (balance?.output1) {
          balance.output1.forEach((item: any) => {
            if (Number(item.hldg_qty) > 0) items.push({ code: item.pdno, type: 'KR' });
          });
        }

        if (overseasBalance?.output1) {
          overseasBalance.output1.forEach((item: any) => {
            if (Number(item.ovrs_cblc_qty) > 0) items.push({ code: item.ovrs_pdno, type: 'US', excd: item.ovrs_excg_cd });
          });
        }

        // 디버깅용: 수집된 종목 리스트를 Trace 로그에 기록 (1시간에 한 번 정도만 하면 좋겠지만 일단 매번)
        fetch(`/api/kis/price?code=DEBUG&type=ITEMS&count=${items.length}&codes=${items.map(i => i.code).join(',')}`).catch(() => { });

        const results: Record<string, any> = {};
        for (const item of items) {
          try {
            const url = `/api/kis/price?code=${item.code}&type=${item.type}${item.excd ? `&excd=${item.excd}` : ''}`;
            const res = await fetch(url);
            const data = await res.json();

            if (data?.output) {
              results[item.code] = {
                price: data.output.stck_prpr,
                change: data.output.prdy_vrss,
                rate: data.output.prdy_ctrt
              };
            }
            await new Promise(resolve => setTimeout(resolve, 150)); // Rate Limit 준수 및 안정성 보장
          } catch (e) {
            console.error(`Error fetching price for ${item.code}`, e);
          }
        }

        setHoldingPrices(prev => ({ ...prev, ...results }));
      } finally {
        isPolling.current = false;
      }
    }

    fetchHoldingPrices();
    const interval = setInterval(fetchHoldingPrices, 30000);
    return () => clearInterval(interval);
  }, [balance, overseasBalance]);

  // 총 평가 금액 추출 (KIS API DOCS 참조: output2 배열의 첫번째 항목 tot_evlu_amt)
  const totalAsset = balance?.output2?.[0]?.tot_evlu_amt
    ? Number(balance.output2[0].tot_evlu_amt).toLocaleString('ko-KR')
    : "???";

  // 일일 손익 금액 (모의투자: evlu_pfls_smtot_amt, 실전투자: asst_icdc_amt)
  const totalProfitLossItem = balance?.output2?.[0]?.asst_icdc_amt || balance?.output2?.[0]?.evlu_pfls_smtot_amt;
  const totalProfitLossNum = Number(totalProfitLossItem || 0);
  const totalProfitLoss = typeof totalProfitLossItem !== "undefined"
    ? `${totalProfitLossNum > 0 ? '+' : ''}${totalProfitLossNum.toLocaleString('ko-KR')}`
    : "0";

  // 일일 수익률 계산 (모의투자는 asst_icdc_dt_1, 실전은 전일 자산 대비 직접 계산)
  let computedProfitRate = "0.00";
  const bfdyTotal = Number(balance?.output2?.[0]?.bfdy_tot_asst_evlu_amt || 0);
  if (bfdyTotal > 0) {
    computedProfitRate = ((totalProfitLossNum / bfdyTotal) * 100).toFixed(2);
  }
  const profitRate = balance?.output2?.[0]?.asst_icdc_dt_1 || computedProfitRate;

  const isPositive = totalProfitLossNum > 0;

  // 해외 총 평가 금액 (USD)
  const overseasAssetUSD = overseasBalance?.output2?.tot_evlu_pfls_amt
    ? Number(overseasBalance.output2.tot_evlu_pfls_amt).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "???";

  // 해외 수익금/수익률
  const overseasProfitUSD = overseasBalance?.output2?.ovrs_tot_pfls; // 총 손익
  const isPositiveOverseas = Number(overseasProfitUSD) > 0;

  // 국내/해외 통합 보유 종목 리스트 가공
  const holdings = useMemo(() => {
    const list: any[] = [];
    if (balance?.output1 && Array.isArray(balance.output1)) {
      balance.output1.forEach((item: any) => {
        if (Number(item.hldg_qty) > 0) {
          const realPriceData = holdingPrices[item.pdno];
          list.push({
            code: item.pdno,
            name: item.prdt_name || '알 수 없음',
            qty: item.hldg_qty || '0',
            price: Number(realPriceData?.price || item.prpr || 0),
            dailyChange: realPriceData?.change || item.prdy_vrss || '0',
            dailyRate: realPriceData?.rate || item.prdy_ctrt || '0.00',
            eval: Number(item.evlu_amt || 0),
            pnl: item.evlu_pfls_rt || '0.00',
            type: 'Domestic'
          });
        }
      });
    }
    if (overseasBalance?.output1 && Array.isArray(overseasBalance.output1)) {
      overseasBalance.output1.forEach((item: any) => {
        if (Number(item.ovrs_cblc_qty) > 0) {
          const realPriceData = holdingPrices[item.ovrs_pdno];
          list.push({
            name: item.ovrs_item_name || '알 수 없음',
            qty: item.ovrs_cblc_qty || '0',
            price: Number(realPriceData?.price || item.now_pric2 || 0),
            dailyChange: realPriceData?.change || '0.00',
            dailyRate: realPriceData?.rate || '0.00',
            eval: Number(item.evlu_amt_smtl || item.evlu_amt || 0), // 차트 정렬용 원화
            evalUSD: Number(item.ovrs_stck_evlu_amt || 0), // 표시용 달러 (수정됨)
            pnl: item.evlu_pfls_rt || '0.00',
            type: 'Overseas'
          });
        }
      });
    }
    return list.sort((a, b) => (b.eval || 0) - (a.eval || 0));
  }, [balance, overseasBalance, holdingPrices]);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Welcome back, <span className="gradient-text">Investor</span> 👋</h1>
        <p className={styles.subtitle}>오늘의 <span className="gradient-text">프리미엄</span> 자산 현황과 주요 증시 변동을 확인하세요.</p>
      </header>

      {/* Market Indices Bar */}
      <div className={styles.marketBar}>
        {marketIndices.length > 0 ? (
          marketIndices.map((index, idx) => {
            // 안전한 숫자 파싱 함수
            const safeParse = (val: any) => {
              if (val === undefined || val === null) return 0;
              const str = String(val).replace(/,/g, '');
              const num = parseFloat(str);
              return isNaN(num) ? 0 : num;
            };

            const price = safeParse(index.price);
            const amt = safeParse(index.amt);
            const change = index.change || '0.00';
            const regionClass = index.type === 'KR' ? styles.kr : styles.us;

            return (
              <div key={idx} className={`${styles.marketCard} ${regionClass}`}>
                <span className={styles.marketLabel}>{index.name}</span>
                <span className={styles.marketValue}>
                  {price.toLocaleString('ko-KR', { minimumFractionDigits: 2 })}
                </span>
                <div className={`${styles.marketChange} ${index.isUp ? styles.up : styles.down}`}>
                  <span className={styles.marketChangeIcon}>{index.isUp ? '▲' : '▼'}</span>
                  {amt.toLocaleString('ko-KR', { minimumFractionDigits: 2 })} ({change}%)
                </div>
              </div>
            );
          })
        ) : (
          Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className={styles.marketCard} style={{ opacity: 0.5 }}>
              <span className={styles.marketLabel}>불러오는 중...</span>
              <span className={styles.marketValue}>----.--</span>
            </div>
          ))
        )}
      </div>

      <div className={styles.dashboardGrid}>
        <div className={`glass-panel ${styles.widget} ${styles.assetWidget}`}>
          <h3 className={styles.widgetTitle}>국내 자산 평가액</h3>
          {loading ? (
            <div className={styles.assetValue}>불러오는 중...</div>
          ) : (
            <div className={styles.assetValue}>₩ {totalAsset}</div>
          )}
          <div className={styles.assetChange} style={{ color: isPositive ? 'var(--danger-color)' : 'var(--accent-color)' }}>
            {totalProfitLoss} ({profitRate}%) <span>오늘</span>
          </div>

          <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '20px' }}>
            <h3 className={styles.widgetTitle} style={{ fontSize: '1rem', marginBottom: '10px' }}>해외 자산 평가액</h3>
            {loading ? (
              <div className={styles.assetValue} style={{ fontSize: '1.5rem' }}>불러오는 중...</div>
            ) : (
              <div className={styles.assetValue} style={{ fontSize: '1.5rem', color: '#00d2ff' }}>
                $ {overseasAssetUSD !== "???" ? overseasAssetUSD : "0.00"}
              </div>
            )}
            <div className={styles.assetChange} style={{ fontSize: '0.9rem', color: isPositiveOverseas ? 'var(--danger-color)' : 'var(--accent-color)' }}>
              {isPositiveOverseas ? '+' : ''}{Number(overseasProfitUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({overseasBalance?.output2?.tot_pftrt ? Number(overseasBalance.output2.tot_pftrt).toFixed(2) : "0.00"}%) <span>누적</span>
            </div>
          </div>
        </div>

        {/* Watchlist Mini Tileboard */}
        <div className={`glass-panel ${styles.widget} ${styles.watchWidget}`}>
          <h3 className={styles.widgetTitle}>관심 종목 (Watchlist)</h3>
          <div className={styles.tileList}>
            {watchListCodes.map(item => {
              const priceData = watchPrices[item.code];
              const stck_prpr = priceData?.stck_prpr ? Number(priceData.stck_prpr).toLocaleString('ko-KR') : '로딩중...';
              const prdy_ctrt = priceData?.prdy_ctrt || '0.00';
              const isUp = Number(prdy_ctrt) > 0;
              const isDown = Number(prdy_ctrt) < 0;

              const flashState = flashHighlight[item.code];
              const flashClass = flashState === 'up' ? styles.flashUp : flashState === 'down' ? styles.flashDown : '';

              return (
                <div
                  className={`${styles.tile} ${flashClass}`}
                  key={item.code}
                  onClick={() => setSelectedStock({ code: item.code, name: item.name })}
                >
                  <div className={styles.tileHeader}>
                    <span className={styles.itemName}>{item.name}</span>
                    <span className={styles.itemPrice}>{stck_prpr}</span>
                  </div>
                  <div className={`${styles.itemChange} ${isUp ? styles.up : isDown ? styles.down : ''}`}>
                    {isUp ? '+' : ''}{prdy_ctrt}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Charts & AI Suggestion Layout placeholder */}
        <div className={`glass-panel ${styles.widget} ${styles.chartWidget}`}>
          <h3 className={styles.widgetTitle}>자산 포트폴리오 차트</h3>
          {loading ? (
            <div className={styles.placeholder}>데이터를 불러오는 중입니다...</div>
          ) : (
            <PortfolioChart balance={balance} overseasBalance={overseasBalance} />
          )}
        </div>

        {/* Assets List Widget */}
        <div className={`glass-panel ${styles.widget} ${styles.holdingsWidget}`}>
          <h3 className={styles.widgetTitle}>상세 보유 종목 현황</h3>
          {loading ? (
            <div className={styles.placeholder}>목록을 불러오는 중입니다...</div>
          ) : holdings.length === 0 ? (
            <div className={styles.emptyState}>보유 중인 종목이 없습니다.</div>
          ) : (
            <div className={styles.holdingsTableWrapper}>
              <table className={styles.holdingsTable}>
                <thead>
                  <tr>
                    <th>구분</th>
                    <th>종목명</th>
                    <th>현재가</th>
                    <th>전일대비</th>
                    <th>보유수량</th>
                    <th>평가금액</th>
                    <th>수익률</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((item, idx) => (
                    <tr key={idx} style={{
                      backgroundColor: item.type === 'Domestic' ? 'rgba(67, 97, 238, 0.03)' : 'rgba(247, 37, 133, 0.03)',
                      borderLeft: `3px solid ${item.type === 'Domestic' ? '#4361ee' : '#f72585'}`
                    }}>
                      <td>
                        <span className={`${styles.stockTypeTag} ${item.type === 'Domestic' ? styles.domesticTag : styles.overseasTag}`}>
                          {item.type === 'Domestic' ? '국내' : '해외'}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{item.name}</td>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {item.type === 'Domestic'
                          ? `${Number(item.price).toLocaleString()}원`
                          : `$${Number(item.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        }
                      </td>
                      <td style={{
                        color: Number(item.dailyRate) > 0 ? 'var(--danger-color)' : Number(item.dailyRate) < 0 ? 'var(--accent-color)' : 'inherit',
                        fontWeight: 600
                      }}>
                        {Number(item.dailyRate) > 0 ? '▲' : Number(item.dailyRate) < 0 ? '▼' : ''}
                        {item.type === 'Domestic'
                          ? `${Math.abs(Number(item.dailyChange)).toLocaleString()}원`
                          : `$${Math.abs(Number(item.dailyChange)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        } ({item.dailyRate}%)
                      </td>
                      <td>{Number(item.qty).toLocaleString()}</td>
                      <td>
                        {item.type === 'Domestic'
                          ? `${item.eval.toLocaleString()}원`
                          : `$${(item.evalUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        }
                      </td>
                      <td style={{ color: Number(item.pnl) > 0 ? 'var(--danger-color)' : Number(item.pnl) < 0 ? 'var(--accent-color)' : 'inherit', fontWeight: 700 }}>
                        {Number(item.pnl) > 0 ? '+' : ''}{item.pnl}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <StockModal
        isOpen={selectedStock !== null}
        onClose={() => setSelectedStock(null)}
        stockCode={selectedStock?.code || ''}
        stockName={selectedStock?.name || ''}
      />
    </div >
  );
}
