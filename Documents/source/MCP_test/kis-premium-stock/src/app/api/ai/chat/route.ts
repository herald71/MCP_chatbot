import { NextResponse } from 'next/server';
import { KIS_CONFIG, KIS_REAL_BASE_URL, getKisToken } from '../../kis/kisApi';

// 주식 현재가 가져오기 헬퍼 함수
async function getStockPrice(stockCode: string) {
    if (!KIS_CONFIG) throw new Error("KIS API 설정이 없습니다.");
    const APP_KEY = KIS_CONFIG.my_app;
    const APP_SECRET = KIS_CONFIG.my_sec;
    const URL_BASE = KIS_CONFIG.prod || KIS_REAL_BASE_URL;

    const access_token = await getKisToken();
    const res = await fetch(`${URL_BASE}/uapi/domestic-stock/v1/quotations/inquire-price?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=${stockCode}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'authorization': `Bearer ${access_token}`,
            'appkey': APP_KEY,
            'appsecret': APP_SECRET,
            'tr_id': 'FHKST01010100',
        }
    });

    if (!res.ok) {
        throw new Error('KIS API 현재가 조회 실패');
    }

    const data = await res.json();
    const price = data?.output?.stck_prpr; // 현재가
    const changeRate = data?.output?.prdy_ctrt; // 전일 대비 율 
    const per = data?.output?.per; // PER
    const pbr = data?.output?.pbr; // PBR
    const eps = data?.output?.eps; // EPS

    if (!price) {
        return `해당 종목코드(${stockCode})의 가격 정보를 찾을 수 없습니다.`;
    }

    return `종목코드 ${stockCode}의 현재가는 ${Number(price).toLocaleString('ko-KR')}원 이며, 전일 대비 등락률은 ${changeRate}% 입니다.\n[재무지표] PER: ${per || '-'}, PBR: ${pbr || '-'}, EPS: ${eps ? Number(eps).toLocaleString('ko-KR') : '-'}`;
}

// 계좌 포트폴리오 가져오기 헬퍼 함수
async function getMyPortfolio() {
    if (!KIS_CONFIG) throw new Error("KIS API 설정이 없습니다.");
    const APP_KEY = KIS_CONFIG.my_app;
    const APP_SECRET = KIS_CONFIG.my_sec;
    const CANO = String(KIS_CONFIG.my_acct_stock);
    const ACNT_PRDT_CD = String(KIS_CONFIG.my_prod).padStart(2, '0');
    const URL_BASE = KIS_CONFIG.prod || KIS_REAL_BASE_URL;

    const access_token = await getKisToken();
    const isDemo = URL_BASE.includes('openapivts');
    const tr_id = isDemo ? 'VTTC8434R' : 'TTTC8434R'; // 주식잔고조회 TR_ID (모의/실전)

    const res = await fetch(`${URL_BASE}/uapi/domestic-stock/v1/trading/inquire-balance?CANO=${CANO}&ACNT_PRDT_CD=${ACNT_PRDT_CD}&AFHR_FLPR_YN=N&OFL_YN=&INQR_DVSN=02&UNPR_DVSN=01&FUND_STTL_ICLD_YN=N&FNCG_AMT_AUTO_RDPT_YN=N&PRCS_DVSN=00&CTX_AREA_FK100=&CTX_AREA_NK100=`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'authorization': `Bearer ${access_token}`,
            'appkey': APP_KEY,
            'appsecret': APP_SECRET,
            'tr_id': tr_id,
            'custtype': 'P',
        }
    });

    const data = await res.json();

    if (!res.ok || data.rt_cd !== '0') {
        const errMsg = data.msg1 || 'KIS API 계좌조회 실패';
        console.error("Portfolio Fetch Error:", data);
        return `앗! 계좌 정보를 가져오는 데 문제가 발생했습니다. (사유: ${errMsg})`;
    }

    if (!data.output1 || !data.output2) return "계좌 정보를 분석할 수 없습니다.";

    const totalAsset = data.output2[0]?.tot_evlu_amt;
    const holdings = data.output1.filter((i: any) => Number(i.evlu_amt) > 0).map((i: any) => `${i.prdt_name} (${i.hldg_qty}주, 투자수익률 ${i.evlu_pfls_rt}%)`);

    if (holdings.length === 0) {
        return `현재 고객님의 총 자산은 ${Number(totalAsset).toLocaleString()}원이며, 보유 중인 국내 주식 종목이 없습니다.`;
    }

    return `현재 고객님의 국내 계좌 총 자산은 ${Number(totalAsset).toLocaleString('ko-KR')}원입니다. 보유 종목 리스트: ${holdings.join(', ')}`;
}

// 해외 주식 잔고 가져오기 헬퍼 함수
async function getOverseasPortfolio() {
    if (!KIS_CONFIG) throw new Error("KIS API 설정이 없습니다.");
    const APP_KEY = KIS_CONFIG.my_app;
    const APP_SECRET = KIS_CONFIG.my_sec;
    const CANO = String(KIS_CONFIG.my_acct_stock);
    const ACNT_PRDT_CD = String(KIS_CONFIG.my_prod).padStart(2, '0');
    const URL_BASE = KIS_CONFIG.prod || KIS_REAL_BASE_URL;

    const access_token = await getKisToken();
    const isDemo = URL_BASE.includes('openapivts');
    const tr_id = isDemo ? 'VTTT3012R' : 'JTTT3012R'; // 해외주식 잔고 TR_ID (모의/실전)

    const res = await fetch(`${URL_BASE}/uapi/overseas-stock/v1/trading/inquire-balance?CANO=${CANO}&ACNT_PRDT_CD=${ACNT_PRDT_CD}&OVRS_EXCG_CD=NASD&TR_CRCY_CD=USD&CTX_AREA_FK200=&CTX_AREA_NK200=`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'authorization': `Bearer ${access_token}`,
            'appkey': APP_KEY,
            'appsecret': APP_SECRET,
            'tr_id': tr_id,
        }
    });

    if (!res.ok) {
        throw new Error('KIS API 해외 계좌조회 실패');
    }

    const data = await res.json();
    if (!data.output1 || !data.output2) return "해외 계좌 정보를 불러올 수 없습니다.";

    const totalAssetUSD = data.output2[0]?.tot_evlu_pfls_amt;
    // 종목코드(ovrs_pdno)와 거래소코드(ovrs_excg_cd)도 함께 문자열로 반환하여 AI가 이를 활용해 현재가 등 상세 조회 가능토록 함
    const holdings = data.output1.filter((i: any) => Number(i.ovrs_cblc_qty) > 0).map((i: any) => `- ${i.ovrs_item_name} (종목코드: ${i.ovrs_pdno}, 거래소: ${i.ovrs_excg_cd}, ${i.ovrs_cblc_qty}주, 수익률 ${i.evlu_pfls_rt}%)`);

    if (holdings.length === 0) {
        return `현재 보유 중인 해외 주식 종목이 없습니다.`;
    }

    return `현재 고객님의 해외 주식 총 평가 금액은 ${Number(totalAssetUSD).toLocaleString('ko-KR')} USD 입니다.\n[해외 보유 종목 리스트]\n${holdings.join('\n')}`;
}

// 해외 주식 가격 및 상세 재무 데이터 가져오기 헬퍼 함수
async function getOverseasStockPrice(excd: string, symb: string) {
    if (!KIS_CONFIG) throw new Error("KIS API 설정이 없습니다.");
    const APP_KEY = KIS_CONFIG.my_app;
    const APP_SECRET = KIS_CONFIG.my_sec;
    const URL_BASE = KIS_CONFIG.prod || KIS_REAL_BASE_URL;

    const access_token = await getKisToken();
    const tr_id = 'HHDFS76200200'; // 해외주식 현재가상세

    const res = await fetch(`${URL_BASE}/uapi/overseas-price/v1/quotations/price-detail?AUTH=&EXCD=${excd}&SYMB=${symb}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'authorization': `Bearer ${access_token}`,
            'appkey': APP_KEY,
            'appsecret': APP_SECRET,
            'tr_id': tr_id,
        }
    });

    if (!res.ok) {
        throw new Error(`KIS API 해외 종목 시세 조회 실패: ${symb}`);
    }

    const data = await res.json();
    if (!data.output) return `${symb} 종목의 데이터를 찾을 수 없습니다.`;

    const info = data.output;
    const currentPrice = info.last ? Number(info.last).toLocaleString('ko-KR', { minimumFractionDigits: 2 }) : "-";
    const changeRate = info.t_xrat ? info.t_xrat : "-";
    const per = info.perx && info.perx !== "0.00" ? info.perx : "-";
    const pbr = info.pbrx && info.pbrx !== "0.00" ? info.pbrx : "-";
    const eps = info.epsx && info.epsx !== "0.00" ? info.epsx : "-";

    return `현재가: ${currentPrice} USD, 전일대비 등락률: ${changeRate}% | 재무 데이터 - PER: ${per}, PBR: ${pbr}, EPS: ${eps}`;
}

// 기간별 수익률 가져오기 헬퍼 함수
async function getPeriodProfit(startDate: string, endDate: string) {
    if (!KIS_CONFIG) throw new Error("KIS API 설정이 없습니다.");
    const APP_KEY = KIS_CONFIG.my_app;
    const APP_SECRET = KIS_CONFIG.my_sec;
    const CANO = String(KIS_CONFIG.my_acct_stock);
    const ACNT_PRDT_CD = String(KIS_CONFIG.my_prod).padStart(2, '0');
    const URL_BASE = KIS_CONFIG.prod || KIS_REAL_BASE_URL;

    const access_token = await getKisToken();
    const isDemo = URL_BASE.includes('openapivts');
    const tr_id = isDemo ? 'VTTC8494R' : 'TTTC8494R'; // 기간별손익일별합산조회 (모의/실전)

    // YYYYMMDD 포맷 체크 및 정규화 (사용자가 2024-03-05식으로 보내면 20240305로 변경)
    const start = startDate.replace(/-/g, '');
    const end = endDate.replace(/-/g, '');

    const res = await fetch(`${URL_BASE}/uapi/domestic-stock/v1/trading/inquire-period-profit?CANO=${CANO}&ACNT_PRDT_CD=${ACNT_PRDT_CD}&INQR_STRT_DT=${start}&INQR_END_DT=${end}&SORT_DVSN=00&INQR_DVSN=00&CBLC_DVSN=00&PDNO=&TR_CONT=`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'authorization': `Bearer ${access_token}`,
            'appkey': APP_KEY,
            'appsecret': APP_SECRET,
            'tr_id': tr_id,
            'custtype': 'P'
        }
    });

    if (!res.ok) {
        throw new Error('KIS API 기간별 수익 조회 실패');
    }

    const data = await res.json();
    if (!data.output2 || data.output2.length === 0) return "해당 기간의 수익 데이터를 찾을 수 없습니다.";

    const summary = data.output2[0];
    const assetChange = Number(summary.asst_icdc_amt).toLocaleString('ko-KR');
    const yieldRate = Number(summary.asst_icdc_erng_rt).toFixed(2);

    return `${startDate} 부터 ${endDate} 까지의 총 자산 변동은 ${assetChange}원 이며, 기간 수익률은 ${yieldRate}% 입니다. (참고: 기간 내 실현 손익은 ${Number(summary.rlzt_pfls).toLocaleString()}원 입니다.)`;
}

// 일자별 수익률 추이 가져오기 헬퍼 함수
async function getDailyProfitHistory(startDate: string, endDate: string) {
    if (!KIS_CONFIG) throw new Error("KIS API 설정이 없습니다.");
    const APP_KEY = KIS_CONFIG.my_app;
    const APP_SECRET = KIS_CONFIG.my_sec;
    const CANO = String(KIS_CONFIG.my_acct_stock);
    const ACNT_PRDT_CD = String(KIS_CONFIG.my_prod).padStart(2, '0');
    const URL_BASE = KIS_CONFIG.prod || KIS_REAL_BASE_URL;

    const access_token = await getKisToken();
    const isDemo = URL_BASE.includes('openapivts');
    const tr_id = isDemo ? 'VTTC8494R' : 'TTTC8494R';

    const start = startDate.replace(/-/g, '');
    const end = endDate.replace(/-/g, '');

    // INQR_DVSN=01 : 일별 조회
    const res = await fetch(`${URL_BASE}/uapi/domestic-stock/v1/trading/inquire-period-profit?CANO=${CANO}&ACNT_PRDT_CD=${ACNT_PRDT_CD}&INQR_STRT_DT=${start}&INQR_END_DT=${end}&SORT_DVSN=01&INQR_DVSN=01&CBLC_DVSN=00&PDNO=&TR_CONT=`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'authorization': `Bearer ${access_token}`,
            'appkey': APP_KEY,
            'appsecret': APP_SECRET,
            'tr_id': tr_id,
            'custtype': 'P'
        }
    });

    if (!res.ok) throw new Error('KIS API 일별 수익 조회 실패');

    const data = await res.json();
    if (!data.output1 || data.output1.length === 0) return "해당 기간의 일별 데이터가 없습니다.";

    const history = data.output1.map((i: any) => `- ${i.stck_evlu_dt}: 자산변동 ${Number(i.asst_icdc_amt).toLocaleString()}원 (${i.asst_icdc_erng_rt}%)`);
    return `해당 기간(${startDate}~${endDate})의 일별 자산 변동 추이입니다:\n${history.join('\n')}`;
}

// 종목별 수익 현황 가져오기 헬퍼 함수
async function getStockProfit(startDate: string, endDate: string) {
    if (!KIS_CONFIG) throw new Error("KIS API 설정이 없습니다.");
    const APP_KEY = KIS_CONFIG.my_app;
    const APP_SECRET = KIS_CONFIG.my_sec;
    const CANO = String(KIS_CONFIG.my_acct_stock);
    const ACNT_PRDT_CD = String(KIS_CONFIG.my_prod).padStart(2, '0');
    const URL_BASE = KIS_CONFIG.prod || KIS_REAL_BASE_URL;

    const access_token = await getKisToken();
    const isDemo = URL_BASE.includes('openapivts');
    const tr_id = isDemo ? 'VTTC8494R' : 'TTTC8494R';

    const start = startDate.replace(/-/g, '');
    const end = endDate.replace(/-/g, '');

    // INQR_DVSN=02 : 종목별 조회
    const res = await fetch(`${URL_BASE}/uapi/domestic-stock/v1/trading/inquire-period-profit?CANO=${CANO}&ACNT_PRDT_CD=${ACNT_PRDT_CD}&INQR_STRT_DT=${start}&INQR_END_DT=${end}&SORT_DVSN=00&INQR_DVSN=02&CBLC_DVSN=00&PDNO=&TR_CONT=`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'authorization': `Bearer ${access_token}`,
            'appkey': APP_KEY,
            'appsecret': APP_SECRET,
            'tr_id': tr_id,
            'custtype': 'P'
        }
    });

    if (!res.ok) throw new Error('KIS API 종목별 수익 조회 실패');

    const data = await res.json();
    if (!data.output1 || data.output1.length === 0) return "해당 기간의 종목별 수익 데이터가 없습니다.";

    const stocks = data.output1.map((i: any) => `- ${i.prdt_name}(${i.pdno}): 평가손익 ${Number(i.evlu_pfls_amt).toLocaleString()}원 (${i.evlu_pfls_rt}%)`);
    return `해당 기간(${startDate}~${endDate})의 종목별 수익 현황입니다:\n${stocks.join('\n')}`;
}

// 실현 매매 손익 헬퍼 함수
async function getTradeProfit(startDate: string, endDate: string) {
    if (!KIS_CONFIG) throw new Error("KIS API 설정이 없습니다.");
    const APP_KEY = KIS_CONFIG.my_app;
    const APP_SECRET = KIS_CONFIG.my_sec;
    const CANO = String(KIS_CONFIG.my_acct_stock);
    const ACNT_PRDT_CD = String(KIS_CONFIG.my_prod).padStart(2, '0');
    const URL_BASE = KIS_CONFIG.prod || KIS_REAL_BASE_URL;

    const access_token = await getKisToken();
    const isDemo = URL_BASE.includes('openapivts');
    const tr_id = isDemo ? 'VTTC8715R' : 'TTTC8715R'; // 기간별매매손익현황조회 TR_ID (모의/실전)

    const start = startDate.replace(/-/g, '');
    const end = endDate.replace(/-/g, '');

    const res = await fetch(`${URL_BASE}/uapi/domestic-stock/v1/trading/inquire-period-trade-profit?CANO=${CANO}&ACNT_PRDT_CD=${ACNT_PRDT_CD}&INQR_STRT_DT=${start}&INQR_END_DT=${end}&SORT_DVSN=00&CBLC_DVSN=00&PDNO=&CTX_AREA_FK100=&CTX_AREA_NK100=&TR_CONT=`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'authorization': `Bearer ${access_token}`,
            'appkey': APP_KEY,
            'appsecret': APP_SECRET,
            'tr_id': tr_id,
            'custtype': 'P'
        }
    });

    if (!res.ok) throw new Error('KIS API 매매손익 조회 실패');

    const data = await res.json();
    if (!data.output2 || !data.output1 || data.output1.length === 0) return "해당 기간의 실제 매매(실현손익) 내역이 없습니다.";

    const totalRealizedProfit = Number(data.output2.tot_rlzt_pfls).toLocaleString('ko-KR');
    const trades = data.output1.map((i: any) => {
        const dateStr = i.trad_dt ? `${i.trad_dt.substring(4, 6)}월 ${i.trad_dt.substring(6, 8)}일` : "날짜미상";
        let tradeStr = `- [${dateStr}] ${i.prdt_name}(${i.pdno}): `;
        const buyQty = Number(i.buy_qty);
        const sllQty = Number(i.sll_qty);

        const details = [];
        if (buyQty > 0) details.push(`${buyQty.toLocaleString()}주 매수(${Number(i.buy_amt).toLocaleString()}원)`);
        if (sllQty > 0) details.push(`${sllQty.toLocaleString()}주 매도(${Number(i.sll_amt).toLocaleString()}원)`);

        tradeStr += details.join(', ');
        if (sllQty > 0) {
            tradeStr += ` | 실현손익 ${Number(i.rlzt_pfls).toLocaleString()}원 (${Number(i.pfls_rt).toFixed(2)}%)`;
        }
        return tradeStr;
    });
    return `해당 기간(${startDate}~${endDate})의 실제 매매 내역입니다: 총 실현 손익 ${totalRealizedProfit}원\n\n[매매 상세]\n${trades.join('\n')}`;
}

// 국내 주식 실시간 주문 (현금) 헬퍼 함수
async function orderStockRealtime(pdno: string, ord_qty: string, ord_unpr: string, ord_dvsn: string) {
    if (!KIS_CONFIG) throw new Error("KIS API 설정이 없습니다.");
    const APP_KEY = KIS_CONFIG.my_app;
    const APP_SECRET = KIS_CONFIG.my_sec;
    const CANO = String(KIS_CONFIG.my_acct_stock);
    const ACNT_PRDT_CD = String(KIS_CONFIG.my_prod).padStart(2, '0');
    const URL_BASE = KIS_CONFIG.prod || KIS_REAL_BASE_URL;

    const access_token = await getKisToken();
    const isDemo = URL_BASE.includes('openapivts');
    const tr_id = isDemo ? (ord_dvsn === 'buy' ? 'VTTC0802U' : 'VTTC0801U') : (ord_dvsn === 'buy' ? 'TTTC0802U' : 'TTTC0801U');

    const res = await fetch(`${URL_BASE}/uapi/domestic-stock/v1/trading/order-cash`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'authorization': `Bearer ${access_token}`,
            'appkey': APP_KEY,
            'appsecret': APP_SECRET,
            'tr_id': tr_id,
            'custtype': 'P'
        },
        body: JSON.stringify({
            CANO: CANO,
            ACNT_PRDT_CD: ACNT_PRDT_CD,
            PDNO: pdno,
            ORD_DVSN: "00", // 지정가 기본
            ORD_QTY: ord_qty,
            ORD_UNPR: ord_unpr
        })
    });

    const data = await res.json();
    if (data.rt_cd !== '0') return `주문 실패: ${data.msg1}`;
    return `실시간 ${ord_dvsn === 'buy' ? '매수' : '매도'} 주문이 성공적으로 접수되었습니다. 주문번호: ${data.output.ODNO}`;
}

// 국내 주식 예약 주문 헬퍼 함수
async function orderStockResv(pdno: string, ord_qty: string, ord_unpr: string, rsvn_ord_dt: string, sll_buy_dvsn_cd: string) {
    if (!KIS_CONFIG) throw new Error("KIS API 설정이 없습니다.");
    const URL_BASE = KIS_CONFIG.prod || KIS_REAL_BASE_URL;
    const access_token = await getKisToken();
    const isDemo = URL_BASE.includes('openapivts');

    // 예약주문 TR_ID: 실전/모의 모두 CTSC0008U (KIS 서버 내부에서 처리)
    // 단, 타겟 서버 오류 방지를 위해 prefix는 T 또는 V로 자동 전환될 수 있으나 예제 기준 CTSC0008U 사용
    const tr_id = isDemo ? 'VTSC0008U' : 'CTSC0008U';

    const res = await fetch(`${URL_BASE}/uapi/domestic-stock/v1/trading/order-resv`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'authorization': `Bearer ${access_token}`,
            'appkey': KIS_CONFIG.my_app,
            'appsecret': KIS_CONFIG.my_sec,
            'tr_id': tr_id,
            'custtype': 'P'
        },
        body: JSON.stringify({
            CANO: String(KIS_CONFIG.my_acct_stock),
            ACNT_PRDT_CD: String(KIS_CONFIG.my_prod).padStart(2, '0'),
            PDNO: pdno,
            ORD_QTY: ord_qty,
            ORD_UNPR: ord_unpr,
            SLL_BUY_DVSN_CD: sll_buy_dvsn_cd === 'buy' ? '02' : '01',
            ORD_DVSN_CD: "00", // 지정가
            ORD_OBJT_CBLC_DVSN_CD: "10", // 현금잔고
            RSVN_ORD_END_DT: rsvn_ord_dt.replace(/-/g, ''), // 종료일(단발성 주문인 경우 예약일과 동일)
            LOAN_DT: "",
            LDNG_DT: ""
        })
    });

    const data = await res.json();
    if (data.rt_cd !== '0') return `예약 주문 실패: ${data.msg1}`;
    return `예약 ${sll_buy_dvsn_cd === 'buy' ? '매수' : '매도'} 주문이 ${rsvn_ord_dt} 날짜로 접수되었습니다. 예약번호: ${data.output?.RSVN_ORD_SEQ || '확인불가'}`;
}

// 국내 주식 예약 주문 조회 헬퍼 함수
async function getStockResvList(startDate: string, endDate: string) {
    if (!KIS_CONFIG) throw new Error("KIS API 설정이 없습니다.");
    const URL_BASE = KIS_CONFIG.prod || KIS_REAL_BASE_URL;
    const access_token = await getKisToken();
    const isDemo = URL_BASE.includes('openapivts');
    const tr_id = isDemo ? 'VTSC0004R' : 'CTSC0004R';

    const productCode = String(KIS_CONFIG.my_acct_stock_prod || KIS_CONFIG.my_prod || '01').padStart(2, '0');
    const res = await fetch(`${URL_BASE}/uapi/domestic-stock/v1/trading/order-resv-ccnl?RSVN_ORD_ORD_DT=${startDate.replace(/-/g, '')}&RSVN_ORD_END_DT=${endDate.replace(/-/g, '')}&RSVN_ORD_SEQ=&TMNL_MDIA_KIND_CD=00&CANO=${KIS_CONFIG.my_acct_stock}&ACNT_PRDT_CD=${productCode}&PRCS_DVSN_CD=0&CNCL_YN=N&PDNO=&SLL_BUY_DVSN_CD=&CTX_AREA_FK200=&CTX_AREA_NK200=`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'authorization': `Bearer ${access_token}`,
            'appkey': KIS_CONFIG.my_app,
            'appsecret': KIS_CONFIG.my_sec,
            'tr_id': tr_id,
            'custtype': 'P'
        }
    });

    const data = await res.json();
    if (data.rt_cd !== '0') return `조회 실패: ${data.msg1}`;
    if (!data.output || data.output.length === 0) return "해당 기간의 예약 주문 내역이 없습니다.";

    // 취소완료 건은 제외하고 미처리/정상 건만 필터링
    const activeOrders = data.output.filter((i: any) => i.prcs_rslt !== '취소완료' && i.cncl_yn !== 'Y');
    if (activeOrders.length === 0) return "해당 기간에 유효한(취소되지 않은) 예약 주문 내역이 없습니다.";

    const list = activeOrders.map((i: any) => `- [실행예정일: ${i.rsvn_ord_ord_dt}] ${i.kor_item_shtn_name}(${i.pdno}): ${i.sll_buy_dvsn_cd === '02' ? '매수' : '매도'} ${i.ord_rsvn_qty}주, 가격 ${Number(i.ord_rsvn_unpr).toLocaleString()}원 (예약순번: ${i.rsvn_ord_seq}, 접수일: ${i.rsvn_ord_rcit_dt})`);
    return `현재 예약 주문 내역입니다:\n${list.join('\n')}`;
}

// 국내 주식 예약 주문 취소 헬퍼 함수
async function cancelStockResv(rsvn_ord_seq: string, rsvn_ord_dt: string, rsvn_ord_orgno: string) {
    if (!KIS_CONFIG) throw new Error("KIS API 설정이 없습니다.");
    const URL_BASE = KIS_CONFIG.prod || KIS_REAL_BASE_URL;
    const access_token = await getKisToken();
    const isDemo = URL_BASE.includes('openapivts');
    const tr_id = isDemo ? 'VTSC0009U' : 'CTSC0009U';

    const res = await fetch(`${URL_BASE}/uapi/domestic-stock/v1/trading/order-resv-rvsecncl`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'authorization': `Bearer ${access_token}`,
            'appkey': KIS_CONFIG.my_app,
            'appsecret': KIS_CONFIG.my_sec,
            'tr_id': tr_id,
            'custtype': 'P'
        },
        body: JSON.stringify({
            CANO: String(KIS_CONFIG.my_acct_stock),
            ACNT_PRDT_CD: String(KIS_CONFIG.my_prod).padStart(2, '0'),
            RSVN_ORD_SEQ: rsvn_ord_seq,
            RSVN_ORD_ORGNO: rsvn_ord_orgno,
            RSVN_ORD_ORD_DT: rsvn_ord_dt.replace(/-/g, ''),
            ORD_TYPE: "cancel"
        })
    });

    const data = await res.json();
    if (data.rt_cd !== '0') return `취소 실패: ${data.msg1}`;
    return `예약 번호 ${rsvn_ord_seq} 주문이 성공적으로 취소되었습니다.`;
}

// 해외 주식 실시간 주문 헬퍼 함수
async function orderOverseasStockRealtime(excd: string, symb: string, ord_qty: string, ord_unpr: string, ord_dvsn: string) {
    if (!KIS_CONFIG) throw new Error("KIS API 설정이 없습니다.");
    const URL_BASE = KIS_CONFIG.prod || KIS_REAL_BASE_URL;
    const access_token = await getKisToken();
    const isDemo = URL_BASE.includes('openapivts');
    const tr_id = isDemo ? (ord_dvsn === 'buy' ? 'VTTT1002U' : 'VTTT1001U') : (ord_dvsn === 'buy' ? 'JTTT1002U' : 'JTTT1001U');

    const res = await fetch(`${URL_BASE}/uapi/overseas-stock/v1/trading/order`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'authorization': `Bearer ${access_token}`,
            'appkey': KIS_CONFIG.my_app,
            'appsecret': KIS_CONFIG.my_sec,
            'tr_id': tr_id,
        },
        body: JSON.stringify({
            CANO: KIS_CONFIG.my_acct_stock,
            ACNT_PRDT_CD: String(KIS_CONFIG.my_prod).padStart(2, '0'),
            OVRS_EXCG_CD: excd,
            PDNO: symb,
            ORD_QTY: ord_qty,
            OVRS_ORD_UNPR: ord_unpr,
            ORD_DVSN: "00",
            TR_CRCY_CD: "USD"
        })
    });

    const data = await res.json();
    if (data.rt_cd !== '0') return `해외 주문 실패: ${data.msg1}`;
    return `해외 실시간 ${ord_dvsn === 'buy' ? '매수' : '매도'} 주문이 접수되었습니다. 주문번호: ${data.output.ODNO}`;
}

// 해외 주식 예약 주문 헬퍼 함수
async function orderOverseasStockResv(excd: string, symb: string, ord_qty: string, ord_unpr: string, ord_dvsn: string) {
    if (!KIS_CONFIG) throw new Error("KIS API 설정이 없습니다.");
    const URL_BASE = KIS_CONFIG.prod || KIS_REAL_BASE_URL;
    const isDemo = URL_BASE.includes('openapivts');
    const access_token = await getKisToken();

    // TR ID 설정
    let tr_id = "";
    if (ord_dvsn === 'buy') {
        tr_id = isDemo ? 'VTTT3014U' : 'TTTT3014U';
    } else {
        tr_id = isDemo ? 'VTTT3016U' : 'TTTT3016U';
    }

    const res = await fetch(`${URL_BASE}/uapi/overseas-stock/v1/trading/order-resv`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'authorization': `Bearer ${access_token}`,
            'appkey': KIS_CONFIG.my_app,
            'appsecret': KIS_CONFIG.my_sec,
            'tr_id': tr_id,
        },
        body: JSON.stringify({
            CANO: KIS_CONFIG.my_acct_stock,
            ACNT_PRDT_CD: String(KIS_CONFIG.my_prod).padStart(2, '0'),
            OVRS_EXCG_CD: excd,
            PDNO: symb,
            FT_ORD_QTY: ord_qty,
            FT_ORD_UNPR3: ord_unpr,
        })
    });

    const data = await res.json();
    if (data.rt_cd !== '0') return `해외 예약 실패: ${data.msg1}`;
    return `해외 예약 ${ord_dvsn === 'buy' ? '매수' : '매도'} 주문이 접수되었습니다. 예약번호: ${data.output.ODNO}`;
}

// 해외 주식 예약 주문 조회 헬퍼 함수
async function getOverseasStockResvList(startDate: string, endDate: string) {
    if (!KIS_CONFIG) throw new Error("KIS API 설정이 없습니다.");
    const URL_BASE = KIS_CONFIG.prod || KIS_REAL_BASE_URL;
    const access_token = await getKisToken();

    const isDemo = URL_BASE.includes('openapivts');
    const tr_id = isDemo ? 'JTTT3039R' : 'TTTT3039R'; // JTTT3039R은 추측이나, 실전은 TTTT3039R 확실

    const res = await fetch(`${URL_BASE}/uapi/overseas-stock/v1/trading/order-resv-list?CANO=${KIS_CONFIG.my_acct_stock}&ACNT_PRDT_CD=${String(KIS_CONFIG.my_prod).padStart(2, '0')}&NAT_DV=us&OVRS_EXCG_CD=NASD&INQR_STRT_DT=${startDate.replace(/-/g, '')}&INQR_END_DT=${endDate.replace(/-/g, '')}&INQR_DVSN_CD=00&CTX_AREA_FK200=&CTX_AREA_NK200=`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'authorization': `Bearer ${access_token}`,
            'appkey': KIS_CONFIG.my_app,
            'appsecret': KIS_CONFIG.my_sec,
            'tr_id': tr_id,
        }
    });

    const data = await res.json();
    if (data.rt_cd !== '0') return `해외 예약 조회 실패: ${data.msg1}`;
    if (!data.output || data.output.length === 0) return "해당 기간의 해외 예약 주문 내역이 없습니다.";

    // 취소된 주문(cncl_yn: 'Y') 필터링
    const activeOrders = data.output.filter((i: any) => i.cncl_yn !== 'Y');
    if (activeOrders.length === 0) return "해당 기간에 유효한(취소되지 않은) 해외 예약 주문 내역이 없습니다.";

    const list = activeOrders.map((i: any) => `- [접수일: ${i.rsvn_ord_rcit_dt}] ${i.prdt_name}(${i.pdno}): ${i.sll_buy_dvsn_cd_name} ${i.ft_ord_qty}주, 가격 ${Number(i.ft_ord_unpr3).toFixed(2)} USD (예약번호: ${i.ovrs_rsvn_odno})`);
    return `현재 해외 예약 주문 내역입니다:\n${list.join('\n')}`;
}

// 해외 주식 예약 주문 취소 헬퍼 함수
async function cancelOverseasStockResv(rsvn_ord_ord_no: string, rsvn_ord_dt: string) {
    if (!KIS_CONFIG) throw new Error("KIS API 설정이 없습니다.");
    const URL_BASE = KIS_CONFIG.prod || KIS_REAL_BASE_URL;
    const access_token = await getKisToken();

    const isDemo = URL_BASE.includes('openapivts');
    const tr_id = isDemo ? 'VTTT3017U' : 'TTTT3017U';

    const res = await fetch(`${URL_BASE}/uapi/overseas-stock/v1/trading/order-resv-ccnl`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'authorization': `Bearer ${access_token}`,
            'appkey': KIS_CONFIG.my_app,
            'appsecret': KIS_CONFIG.my_sec,
            'tr_id': tr_id,
        },
        body: JSON.stringify({
            CANO: KIS_CONFIG.my_acct_stock,
            ACNT_PRDT_CD: String(KIS_CONFIG.my_prod).padStart(2, '0'),
            NAT_DV: "us",
            RSVN_ORD_RCIT_DT: rsvn_ord_dt.replace(/-/g, ''),
            OVRS_RSVN_ODNO: rsvn_ord_ord_no
        })
    });

    const data = await res.json();
    if (data.rt_cd !== '0') return `해외 예약 취소 실패: ${data.msg1}`;
    return `해외 예약 번호 ${rsvn_ord_ord_no} 주문이 성공적으로 취소되었습니다.`;
}

// 실시간 웹 뉴스 검색 헬퍼 함수 (Google News RSS 활용)
async function searchWeb(query: string) {
    try {
        const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;
        const response = await fetch(url);
        const xml = await response.text();

        // XML에서 <item> 내의 <title> 추출 (단순 정규식)
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        const titleRegex = /<title>(.*?)<\/title>/;

        let match;
        const titles = [];
        let limit = 10;

        while ((match = itemRegex.exec(xml)) !== null && limit > 0) {
            const itemContent = match[1];
            const titleMatch = titleRegex.exec(itemContent);
            if (titleMatch) {
                // 구글 뉴스 제목은 "제목 - 언론사" 형식이므로 제목만 추출하거나 그대로 사용
                titles.push(`• ${titleMatch[1]}`);
                limit--;
            }
        }

        return titles.length ? titles.join('\n') : "현재 관련된 뉴스를 추가로 찾을 수 없습니다.";
    } catch (e) {
        console.error("Web Search Error:", e);
        return "뉴스 검색 중 오류가 발생했습니다. 나중에 다시 시도해 주세요.";
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { message, history } = body;

        const apiKey = process.env.OPENAI_API_KEY;

        if (!apiKey || apiKey === 'sk-여기에_실제_API_키를_입력해주세요') {
            return NextResponse.json({
                reply: "OpenAI API 키가 올바르게 설정되지 않았습니다. `.env.local` 파일을 확인해 주세요."
            });
        }

        const systemPrompt = `당신은 한국투자증권(KIS) 데이터와 연동된 상위 1% VIP 전용 '프리미엄 AI 투자 어시스턴트'입니다. 
사용자에게 언제나 긍정적이고 즐거운 톤으로, 이해하기 쉽고 명확하게 답변해 주세요! 😊

[핵심 행동 지침]
1. 사용자가 국내 주가나 특정 종목의 상태를 물어보면 반드시 'get_current_stock_price' 함수를 사용하여 데이터를 가져오고, 해외 주식의 경우 'get_overseas_stock_price'를 호출하세요.
2. 데이터를 그냥 나열하지 말고, 전일 대비 등락(%)을 분석하여 가벼운 시황 코멘트나 격려의 말을 더해 풍부하게 대답하세요.
3. 어려운 금융 용어가 있다면 주린이(초보 투자자)도 단번에 이해할 수 있도록 일상적인 비유를 들어 쉽게 설명해 주세요.
4. 대화는 딱딱하지 않게, 적절한 이모지를 섞어가며 매끄럽고 친절하게 진행하세요!
5. \*\*[중요: 가독성 극대화]\*\* 답변이 통짜 글로 뭉쳐 보이지 않도록 **줄바꿈(\n)과 빈 줄을 적극적으로 사용**하세요. 종목이나 핵심 내용을 설명할 때는 숫자나 글머리 기호(-, *)를 사용하여 보기 좋게 문단을 나눠주세요. 
6. 사용자가 "내 계좌", "내 포트폴리오", "내 자산" 등에 대해 물어보면 'get_my_portfolio' 함수를 호출하고, 해외 주식을 언급하면 'get_overseas_portfolio' 함수도 함께 호출하여 실제 잔고와 보유 종목을 확인한 후 맞춤형 처방을 내려주세요.
7. **예약 주문 현황 조회 시 필수 준수:** 예약 내역을 물어보면 '접수일'이 아니라 실제 주문이 나가는 '실행 예정일' 기준으로 조회됨을 명심하세요. 따라서 사용자가 특정 날짜를 지정하지 않는 한, **반드시 종료일(endDate)을 오늘로부터 30일 뒤(20260408)로 설정**하여 미래의 모든 예약을 보여주세요. (국내: get_stock_resv_list, 해외: get_overseas_stock_resv_list 호출 시 날짜 범위 주의)
8. 보유 종목(국내 또는 해외)의 PER, PBR, EPS 같은 재무 데이터를 모두 보여달라고 요청받으면, 제일 먼저 'get_my_portfolio' 또는 'get_overseas_portfolio'를 호출하여 보유 중인 종목 리스트와 '종목코드', '거래소(해외의 경우)'를 파악하세요. 그 후 파악된 모든 보유 종목들에 대해 각각 'get_current_stock_price' (국내) 또는 'get_overseas_stock_price' (해외) 함수를 호출하여(여러 번 반복 호출하여) 실제 재무 데이터를 수집한 뒤 표나 리스트로 정리해서 답변하세요.
9. 사용자가 특정 날짜나 기간 동안의 수익률, 손익, "실제 매매 실현 손익"을 물어보면 '분석 프로세스'를 따라 여러 함수를 적절히 함께 호출하세요.

[현재 시각 및 환경]
- 오늘 날짜: 2026년 3월 8일 일요일 (예약 조회 시 날짜 계산 주의!)
- 사용자 환경: 프리미엄 투자 대시보드 사용자
- 분석 프로세스:
  1) 전체 요약 확인: 'get_period_profit' 호출 (총 자산 변동)
  2) 실제 매매 실현손익 확인: 'get_trade_profit' 호출 (실제 매매로 확정된 수익/손실)
  3) 상세 흐름 파악: 'get_daily_profit_history' 호출 (일별 변동 분석)
  4) 종목별 평가(미실현) 성과 분석: 'get_stock_profit' 호출
  위 도구들을 적절히 조합하여 데이터에 기반한 압도적인 전문 분석을 제공하세요.
- 🚨 [경고: 절대 금지 사항] 🚨
  1) 제공된 tool의 결과 데이터에 있는 "종목명"과 "종목코드", "수익금", "실현손익"을 절대로 마음대로 바꾸거나 유추해서 다른 종목으로 지어내지 마세요. 주작이나 환각(Hallucination)은 절대 금지됩니다!
  2) 반드시 KIS API(tool 호출)를 통해 반환된 실제 팩트 데이터만을 기반으로 분석 및 답변하세요. 본인의 외부 지식이나 자의적인 판단으로 수치, 종목, 자산 상태를 지어내거나 변경하는 것은 엄격히 금지됩니다.
9. 사용자가 종목의 "최신 뉴스"나 "이슈"를 물어보면 반드시 'search_web' 도구를 사용하여 인터넷 검색을 수행하고, 검색된 뉴스 요약문들을 기반으로 최근 상황을 브리핑해 주세요.
10. **[중요: 주문 실행 관련]** 사용자가 주식 매수 또는 매도를 요청하면 상황에 따라 다음 도구를 사용하세요:
  - 즉시(실시간) 주문: 'order_stock_realtime' (국내) 또는 'order_overseas_stock_realtime' (해외) 호출
  - 예약 주문: 'order_stock_resv' (국내) 또는 'order_overseas_stock_resv' (해외) 호출. 기간이 포함된 경우(예: 3월 말까지) 해당 기간의 마지막 날을 예약일로 설정하거나 사용자에게 확인하세요.
  - 조회/취소: 'get_stock_resv_list', 'cancel_stock_resv' 등을 사용하여 관리하세요.
  - **[결제 확인]** 모든 주문(실시간/예약) 실행 전에는 반드시 종목명, 수량, 가격을 다시 한번 불러주며 사용자에게 최종 확인을 받으세요.`;

        let messages: any[] = [
            { role: 'system', content: systemPrompt },
            ...(history || []),
            { role: 'user', content: message }
        ];

        const tools = [
            {
                type: 'function',
                function: {
                    name: 'get_current_stock_price',
                    description: '특정 한국 주식의 실시간 현재가와 등락률 및 주요 재무지표(PER, PBR, EPS) 데이터를 조회합니다. 주가, PER 둥을 물어볼 때 사용하세요.',
                    parameters: {
                        type: 'object',
                        properties: {
                            stockCode: {
                                type: 'string',
                                description: '조회할 주식의 6자리 한국 종목코드 (예: 삼성전자는 "005930", SK하이닉스는 "000660")'
                            }
                        },
                        required: ['stockCode']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'get_my_portfolio',
                    description: '현재 접속한 사용자의 계좌 잔고(총 자산)와 보유 주식 종목 리스트, 그리고 각 종목의 비중 및 수익률을 실시간으로 조회합니다. 포트폴리오 진단에 필수적입니다.',
                    parameters: {
                        type: 'object',
                        properties: {}
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'get_overseas_portfolio',
                    description: '고객의 현재 해외 주식 계좌 잔고 및 보유 종목 리스트를 조회합니다. 해외 주식을 물어볼 때 호출하세요.',
                    parameters: {
                        type: 'object',
                        properties: {}
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'get_overseas_stock_price',
                    description: '특정 해외 보유 종목의 현재가, 변동률 및 재무 데이터(PER, PBR, EPS 등)를 조회합니다. 해외 주식을 물어볼 때 호출하세요.',
                    parameters: {
                        type: 'object',
                        properties: {
                            excd: {
                                type: 'string',
                                description: '거래소코드 (예: NAS, NYS, AMS 등). (기본값: NAS)'
                            },
                            symb: {
                                type: 'string',
                                description: '종목 티커 (예: AAPL, TSLA)'
                            }
                        },
                        required: ['excd', 'symb']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'get_period_profit',
                    description: '특정 시작일로부터 종료일까지의 전체 계좌 수익 금액과 수익률(%) 합계를 조회합니다.',
                    parameters: {
                        type: 'object',
                        properties: {
                            startDate: {
                                type: 'string',
                                description: '조회 시작일 (YYYYMMDD 형식, 예: 20260305)'
                            },
                            endDate: {
                                type: 'string',
                                description: '조회 종료일 (YYYYMMDD 형식, 예: 20260306)'
                            }
                        },
                        required: ['startDate', 'endDate']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'get_daily_profit_history',
                    description: '특정 기간 동안의 일자별 자산 변동(손익)과 수익률 추이를 상세히 조회합니다. 날짜별 흐름 분석에 사용하세요.',
                    parameters: {
                        type: 'object',
                        properties: {
                            startDate: {
                                type: 'string',
                                description: '조회 시작일 (YYYYMMDD 형식, 예: 20260301)'
                            },
                            endDate: {
                                type: 'string',
                                description: '조회 종료일 (YYYYMMDD 형식, 예: 20260307)'
                            }
                        },
                        required: ['startDate', 'endDate']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'get_stock_profit',
                    description: '특정 기간 동안의 각 종목별 수익금과 수익률 상세 현황을 조회합니다. 어떤 종목에서 수익/손실이 났는지 분석할 때 사용하세요.',
                    parameters: {
                        type: 'object',
                        properties: {
                            startDate: {
                                type: 'string',
                                description: '조회 시작일 (YYYYMMDD 형식, 예: 20260301)'
                            },
                            endDate: {
                                type: 'string',
                                description: '조회 종료일 (YYYYMMDD 형식, 예: 20260307)'
                            }
                        },
                        required: ['startDate', 'endDate']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'get_trade_profit',
                    description: '특정 기간 동안의 실제 사고 판(매수/매도) 거래 내역 및 실현 손익 현황을 상세히 조회합니다.',
                    parameters: {
                        type: 'object',
                        properties: {
                            startDate: { type: 'string', description: '조회 시작일 (YYYYMMDD 형식, 예: 20260301)' },
                            endDate: { type: 'string', description: '조회 종료일 (YYYYMMDD 형식, 예: 20260307)' }
                        },
                        required: ['startDate', 'endDate']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'search_web',
                    description: '특정 키워드(종목명 뉴스 등)로 실시간 웹 검색 결과를 가져와 최신 이슈를 파악합니다.',
                    parameters: {
                        type: 'object',
                        properties: {
                            query: {
                                type: 'string',
                                description: '검색어 (예: "삼성전자 최신 뉴스", "마이크로소프트 주가 급등 이유")'
                            }
                        },
                        required: ['query']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'order_stock_realtime',
                    description: '국내 주식 실시간 즉시 매수/매도 주문을 실행합니다.',
                    parameters: {
                        type: 'object',
                        properties: {
                            pdno: { type: 'string', description: '6자리 종목코드' },
                            ord_qty: { type: 'string', description: '수량' },
                            ord_unpr: { type: 'string', description: '단가' },
                            ord_dvsn: { type: 'string', enum: ['buy', 'sell'], description: '매수(buy)/매도(sell)' }
                        },
                        required: ['pdno', 'ord_qty', 'ord_unpr', 'ord_dvsn']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'order_stock_resv',
                    description: '국내 주식 특정 날짜의 예약 주문을 등록합니다.',
                    parameters: {
                        type: 'object',
                        properties: {
                            pdno: { type: 'string', description: '6자리 종목코드' },
                            ord_qty: { type: 'string', description: '수량' },
                            ord_unpr: { type: 'string', description: '단가' },
                            rsvn_ord_dt: { type: 'string', description: '예약일(YYYYMMDD)' },
                            sll_buy_dvsn_cd: { type: 'string', enum: ['buy', 'sell'], description: '매수(buy)/매도(sell)' }
                        },
                        required: ['pdno', 'ord_qty', 'ord_unpr', 'rsvn_ord_dt', 'sll_buy_dvsn_cd']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'get_stock_resv_list',
                    description: '국내 주식 예약 주문 내역을 조회합니다. 주의: 조회한 날짜 범위 내에서 "실행(발주) 예정인" 주문을 찾습니다. 현재 예약된 전체 목록을 보고 싶다면 종료일(endDate)을 오늘 이후의 미래 날짜(예: 한 달 뒤)로 설정하세요.',
                    parameters: {
                        type: 'object',
                        properties: {
                            startDate: { type: 'string', description: '조회 시작일 (YYYYMMDD 형식)' },
                            endDate: { type: 'string', description: '조회 종료일 (YYYYMMDD 형식, 미래 예약을 보려면 미래 날짜 입력)' }
                        },
                        required: ['startDate', 'endDate']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'cancel_stock_resv',
                    description: '국내 주식 예약 주문을 취소합니다.',
                    parameters: {
                        type: 'object',
                        properties: {
                            rsvn_ord_seq: { type: 'string', description: '예약순번 (조회 시 확인 가능)' },
                            rsvn_ord_dt: { type: 'string', description: '예약일자(YYYYMMDD)' },
                            rsvn_ord_orgno: { type: 'string', description: '예약조직번호 (조회 시 확인 가능)' }
                        },
                        required: ['rsvn_ord_seq', 'rsvn_ord_dt', 'rsvn_ord_orgno']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'order_overseas_stock_realtime',
                    description: '해외 주식 실시간 즉시 주문을 실행합니다.',
                    parameters: {
                        type: 'object',
                        properties: {
                            excd: { type: 'string', description: '거래소(예: NASD, NYSE)' },
                            symb: { type: 'string', description: '티커(예: AAPL)' },
                            ord_qty: { type: 'string', description: '수량' },
                            ord_unpr: { type: 'string', description: '단가(USD)' },
                            ord_dvsn: { type: 'string', enum: ['buy', 'sell'], description: '매수/매도' }
                        },
                        required: ['excd', 'symb', 'ord_qty', 'ord_unpr', 'ord_dvsn']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'order_overseas_stock_resv',
                    description: '해외 주식 예약 주문을 등록합니다.',
                    parameters: {
                        type: 'object',
                        properties: {
                            excd: { type: 'string', description: '거래소' },
                            symb: { type: 'string', description: '티커' },
                            ord_qty: { type: 'string', description: '수량' },
                            ord_unpr: { type: 'string', description: '단가(USD)' },
                            ord_dvsn: { type: 'string', enum: ['buy', 'sell'], description: '매수/매도' }
                        },
                        required: ['excd', 'symb', 'ord_qty', 'ord_unpr', 'ord_dvsn']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'get_overseas_stock_resv_list',
                    description: '해외 주식 예약 주문 내역을 조회합니다. 주의: 조회한 날짜 범위 내에서 "실행 예정인" 주문을 찾습니다. 시작일과 종료일 간격은 최대 7일이어야 하므로, 미래의 특정 기간을 7일 단위로 끊어서 조회하세요.',
                    parameters: {
                        type: 'object',
                        properties: {
                            startDate: { type: 'string', description: '조회 시작일 (YYYYMMDD 형식)' },
                            endDate: { type: 'string', description: '조회 종료일 (YYYYMMDD 형식, 최대 7일 이내)' }
                        },
                        required: ['startDate', 'endDate']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'cancel_overseas_stock_resv',
                    description: '해외 주식 예약 주문을 취소합니다.',
                    parameters: {
                        type: 'object',
                        properties: {
                            rsvn_ord_ord_no: { type: 'string', description: '예약번호' },
                            rsvn_ord_dt: { type: 'string', description: '예약일자(YYYYMMDD)' }
                        },
                        required: ['rsvn_ord_ord_no', 'rsvn_ord_dt']
                    }
                }
            }
        ];

        let iterationCount = 0;
        const MAX_ITERATIONS = 10;
        let finalReply = "";

        while (iterationCount < MAX_ITERATIONS) {
            iterationCount++;

            // OpenAI API 호출
            const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: 'gpt-4o',
                    messages: messages,
                    tools: tools,
                    tool_choice: 'auto',
                    temperature: 0.8,
                }),
            });

            if (!aiResponse.ok) {
                const errText = await aiResponse.text();
                console.error("OpenAI API Fallback Error:", errText);
                throw new Error('OpenAI API 호출 오류');
            }

            const data = await aiResponse.json();
            const responseMessage = data.choices[0].message;

            // 만약 AI가 함수(Tool)를 호출하기로 결정했다면
            if (responseMessage.tool_calls) {
                messages.push(responseMessage); // AI의 함수 호출 기록 저장

                // Tool Call 처리 로직
                for (const toolCall of responseMessage.tool_calls) {
                    if (toolCall.function.name === 'get_current_stock_price') {
                        const args = JSON.parse(toolCall.function.arguments);
                        try {
                            const resultData = await getStockPrice(args.stockCode);
                            messages.push({
                                tool_call_id: toolCall.id,
                                role: 'tool',
                                name: 'get_current_stock_price',
                                content: resultData,
                            });
                        } catch (e) {
                            messages.push({
                                tool_call_id: toolCall.id,
                                role: 'tool',
                                name: 'get_current_stock_price',
                                content: "API 데이터 조회 중 오류가 발생했습니다.",
                            });
                        }
                    } else if (toolCall.function.name === 'get_my_portfolio') {
                        try {
                            const portfolioData = await getMyPortfolio();
                            messages.push({
                                tool_call_id: toolCall.id,
                                role: 'tool',
                                name: 'get_my_portfolio',
                                content: portfolioData,
                            });
                        } catch (e) {
                            messages.push({
                                tool_call_id: toolCall.id,
                                role: 'tool',
                                name: 'get_my_portfolio',
                                content: "계좌 정보를 조회하는 중 오류가 발생했습니다.",
                            });
                        }
                    } else if (toolCall.function.name === 'get_overseas_portfolio') {
                        try {
                            const portfolioData = await getOverseasPortfolio();
                            messages.push({
                                tool_call_id: toolCall.id,
                                role: 'tool',
                                name: 'get_overseas_portfolio',
                                content: portfolioData,
                            });
                        } catch (e) {
                            messages.push({
                                tool_call_id: toolCall.id,
                                role: 'tool',
                                name: 'get_overseas_portfolio',
                                content: "해외 계좌 정보를 조회하는 중 오류가 발생했습니다.",
                            });
                        }
                    } else if (toolCall.function.name === 'get_overseas_stock_price') {
                        const args = JSON.parse(toolCall.function.arguments);
                        // KIS 잔고에서는 NASD, NYSE 등으로 오지만, 시세조회는 NAS, NYS 등 3자리 코드를 주로 사용.
                        let excd = args.excd || 'NAS';
                        excd = excd.toUpperCase();
                        if (excd === 'NASD') excd = 'NAS';
                        else if (excd === 'NYSE' || excd === 'NYST') excd = 'NYS';
                        else if (excd === 'AMEX') excd = 'AMS';
                        else if (excd === 'SEHK') excd = 'HKS';
                        else if (excd === 'SHAA') excd = 'SHS';
                        else if (excd === 'SZAA') excd = 'SZS';
                        else if (excd === 'TKSE') excd = 'TSE';
                        else if (excd === 'HASE') excd = 'HNX';
                        else if (excd === 'VNSE') excd = 'HSX';

                        try {
                            const resultData = await getOverseasStockPrice(excd, args.symb);
                            messages.push({
                                tool_call_id: toolCall.id,
                                role: 'tool',
                                name: 'get_overseas_stock_price',
                                content: resultData,
                            });
                        } catch (e) {
                            messages.push({
                                tool_call_id: toolCall.id,
                                role: 'tool',
                                name: 'get_overseas_stock_price',
                                content: "해외 주식 API 데이터 조회 중 오류가 발생했습니다.",
                            });
                        }
                    } else if (toolCall.function.name === 'get_period_profit') {
                        const args = JSON.parse(toolCall.function.arguments);
                        try {
                            const periodData = await getPeriodProfit(args.startDate, args.endDate);
                            messages.push({
                                tool_call_id: toolCall.id,
                                role: 'tool',
                                name: 'get_period_profit',
                                content: periodData,
                            });
                        } catch (e) {
                            messages.push({
                                tool_call_id: toolCall.id,
                                role: 'tool',
                                name: 'get_period_profit',
                                content: "해당 기간의 수익 정보를 조회하는 중 오류가 발생했습니다.",
                            });
                        }
                    } else if (toolCall.function.name === 'get_daily_profit_history') {
                        const args = JSON.parse(toolCall.function.arguments);
                        try {
                            const historyData = await getDailyProfitHistory(args.startDate, args.endDate);
                            messages.push({
                                tool_call_id: toolCall.id,
                                role: 'tool',
                                name: 'get_daily_profit_history',
                                content: historyData,
                            });
                        } catch (e) {
                            messages.push({
                                tool_call_id: toolCall.id,
                                role: 'tool',
                                name: 'get_daily_profit_history',
                                content: "일별 추이 정보를 조회하는 중 오류가 발생했습니다.",
                            });
                        }
                    } else if (toolCall.function.name === 'get_stock_profit') {
                        const args = JSON.parse(toolCall.function.arguments);
                        try {
                            const stockData = await getStockProfit(args.startDate, args.endDate);
                            messages.push({
                                tool_call_id: toolCall.id,
                                role: 'tool',
                                name: 'get_stock_profit',
                                content: stockData,
                            });
                        } catch (e) {
                            messages.push({
                                tool_call_id: toolCall.id,
                                role: 'tool',
                                name: 'get_stock_profit',
                                content: "종목별 수익 정보를 조회하는 중 오류가 발생했습니다.",
                            });
                        }
                    } else if (toolCall.function.name === 'get_trade_profit') {
                        const args = JSON.parse(toolCall.function.arguments);
                        try {
                            const tradeData = await getTradeProfit(args.startDate, args.endDate);
                            messages.push({
                                tool_call_id: toolCall.id,
                                role: 'tool',
                                name: 'get_trade_profit',
                                content: tradeData,
                            });
                        } catch (e) {
                            messages.push({
                                tool_call_id: toolCall.id,
                                role: 'tool',
                                name: 'get_trade_profit',
                                content: "실제 매매 실현 손익 데이터를 가져오는 중 오류가 발생했습니다.",
                            });
                        }
                    } else if (toolCall.function.name === 'order_stock_realtime') {
                        const args = JSON.parse(toolCall.function.arguments);
                        try {
                            const result = await orderStockRealtime(args.pdno, args.ord_qty, args.ord_unpr, args.ord_dvsn);
                            messages.push({ tool_call_id: toolCall.id, role: 'tool', name: 'order_stock_realtime', content: result });
                        } catch (e) {
                            messages.push({ tool_call_id: toolCall.id, role: 'tool', name: 'order_stock_realtime', content: "주문 처리 중 오류 발생" });
                        }
                    } else if (toolCall.function.name === 'order_stock_resv') {
                        const args = JSON.parse(toolCall.function.arguments);
                        try {
                            const result = await orderStockResv(args.pdno, args.ord_qty, args.ord_unpr, args.rsvn_ord_dt, args.sll_buy_dvsn_cd);
                            messages.push({ tool_call_id: toolCall.id, role: 'tool', name: 'order_stock_resv', content: result });
                        } catch (e) {
                            messages.push({ tool_call_id: toolCall.id, role: 'tool', name: 'order_stock_resv', content: "예약 주문 중 오류 발생" });
                        }
                    } else if (toolCall.function.name === 'get_stock_resv_list') {
                        const args = JSON.parse(toolCall.function.arguments);
                        try {
                            const result = await getStockResvList(args.startDate, args.endDate);
                            messages.push({ tool_call_id: toolCall.id, role: 'tool', name: 'get_stock_resv_list', content: result });
                        } catch (e) {
                            messages.push({ tool_call_id: toolCall.id, role: 'tool', name: 'get_stock_resv_list', content: "조회 중 오류 발생" });
                        }
                    } else if (toolCall.function.name === 'cancel_stock_resv') {
                        const args = JSON.parse(toolCall.function.arguments);
                        try {
                            const result = await cancelStockResv(args.rsvn_ord_seq, args.rsvn_ord_dt, args.rsvn_ord_orgno);
                            messages.push({ tool_call_id: toolCall.id, role: 'tool', name: 'cancel_stock_resv', content: result });
                        } catch (e) {
                            messages.push({ tool_call_id: toolCall.id, role: 'tool', name: 'cancel_stock_resv', content: "취소 중 오류 발생" });
                        }
                    } else if (toolCall.function.name === 'order_overseas_stock_realtime') {
                        const args = JSON.parse(toolCall.function.arguments);
                        try {
                            const result = await orderOverseasStockRealtime(args.excd, args.symb, args.ord_qty, args.ord_unpr, args.ord_dvsn);
                            messages.push({ tool_call_id: toolCall.id, role: 'tool', name: 'order_overseas_stock_realtime', content: result });
                        } catch (e) {
                            messages.push({ tool_call_id: toolCall.id, role: 'tool', name: 'order_overseas_stock_realtime', content: "해외 주문 중 오류 발생" });
                        }
                    } else if (toolCall.function.name === 'order_overseas_stock_resv') {
                        const args = JSON.parse(toolCall.function.arguments);
                        try {
                            const result = await orderOverseasStockResv(args.excd, args.symb, args.ord_qty, args.ord_unpr, args.ord_dvsn);
                            messages.push({ tool_call_id: toolCall.id, role: 'tool', name: 'order_overseas_stock_resv', content: result });
                        } catch (e) {
                            messages.push({ tool_call_id: toolCall.id, role: 'tool', name: 'order_overseas_stock_resv', content: "해외 예약 중 오류 발생" });
                        }
                    } else if (toolCall.function.name === 'get_overseas_stock_resv_list') {
                        const args = JSON.parse(toolCall.function.arguments);
                        try {
                            const result = await getOverseasStockResvList(args.startDate, args.endDate);
                            messages.push({ tool_call_id: toolCall.id, role: 'tool', name: 'get_overseas_stock_resv_list', content: result });
                        } catch (e) {
                            messages.push({ tool_call_id: toolCall.id, role: 'tool', name: 'get_overseas_stock_resv_list', content: "해외 예약 조회 중 오류 발생" });
                        }
                    } else if (toolCall.function.name === 'cancel_overseas_stock_resv') {
                        const args = JSON.parse(toolCall.function.arguments);
                        try {
                            const result = await cancelOverseasStockResv(args.rsvn_ord_ord_no, args.rsvn_ord_dt);
                            messages.push({ tool_call_id: toolCall.id, role: 'tool', name: 'cancel_overseas_stock_resv', content: result });
                        } catch (e) {
                            messages.push({ tool_call_id: toolCall.id, role: 'tool', name: 'cancel_overseas_stock_resv', content: "해외 취소 중 오류 발생" });
                        }
                    }
                }
                // 루프를 계속 돌아서 도구 실행 결과를 바탕으로 다음 단계를 판단하도록 함
            } else {
                // 더 이상 함수 호출이 없으면 최종 답변으로 결정하고 루프 종료
                finalReply = responseMessage.content;
                break;
            }
        }

        if (iterationCount >= MAX_ITERATIONS) {
            console.warn("AI Assistant hit maximum iteration limit for tool calls.");
        }

        return NextResponse.json({ reply: finalReply || "요청을 처리하는 도중 너무 많은 단계를 거쳐 중단되었습니다. 다시 질문해 주세요." });

    } catch (error: any) {
        console.error("AI Assistant API Error: ", error);
        return NextResponse.json(
            { error: "AI 응답을 처리하는 중 오류가 발생했습니다.", details: error.message },
            { status: 500 }
        );
    }
}
