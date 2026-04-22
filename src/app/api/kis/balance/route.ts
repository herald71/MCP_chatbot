import { NextResponse } from 'next/server';
import { getKisToken, KIS_CONFIG, KIS_REAL_BASE_URL, getAccountKeys } from '../kisApi';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const queryCano = searchParams.get('cano');
    const queryPrdt = searchParams.get('prdt');

    console.log("[Balance API] Received request. KIS_CONFIG status:", !!KIS_CONFIG);
    if (!KIS_CONFIG) {
        console.error("[Balance API] KIS_CONFIG is missing!");
        return NextResponse.json({ error: "KIS API 설정 정보가 없습니다. 서버 로그를 확인하세요." }, { status: 500 });
    }

    const CANO = queryCano || String(KIS_CONFIG.my_acct_stock);
    const ACNT_PRDT_CD = (queryPrdt || String(KIS_CONFIG.my_prod)).padStart(2, '0');
    const URL_BASE = KIS_CONFIG.prod || KIS_REAL_BASE_URL;

    // 계좌 정용 키 가져오기
    const { appkey, appsecret } = getAccountKeys(CANO);

    console.log(`[Balance API] Using account: ${CANO}-${ACNT_PRDT_CD}, AppKey: ${appkey?.substring(0, 5)}...`);

    try {
        // 1. KIS 인증 토큰 발급 (캐싱 전략 사용)
        const accessToken = await getKisToken(appkey, appsecret);

        // 2. 실전투자 계좌 잔고조회 호출 (inquire_balance - API DOC 참조)
        const tr_id = 'TTTC8434R'; // 실전 주식잔고조회 TR_ID

        const balanceRes = await fetch(`${URL_BASE || KIS_REAL_BASE_URL}/uapi/domestic-stock/v1/trading/inquire-balance?CANO=${CANO}&ACNT_PRDT_CD=${ACNT_PRDT_CD}&AFHR_FLPR_YN=N&OFL_YN=&INQR_DVSN=02&UNPR_DVSN=01&FUND_STTL_ICLD_YN=N&FNCG_AMT_AUTO_RDPT_YN=N&PRCS_DVSN=00&CTX_AREA_FK100=&CTX_AREA_NK100=`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'authorization': `Bearer ${accessToken}`,
                'appkey': appkey,
                'appsecret': appsecret,
                'tr_id': tr_id,
            }
        });

        const balanceData = await balanceRes.json();
        console.log(`[Balance API] KIS Response for ${CANO}:`, balanceData.rt_cd, balanceData.msg_cd, balanceData.msg1);
        return NextResponse.json(balanceData);

    } catch (error: any) {
        console.error("API Proxy Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
