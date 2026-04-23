import { NextResponse } from 'next/server';
import { getKisToken, KIS_CONFIG, KIS_REAL_BASE_URL, getAccountKeys } from '../kisApi';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const queryCano = searchParams.get('cano');
    const queryPrdt = searchParams.get('prdt');

    if (!KIS_CONFIG) {
        return NextResponse.json({ error: "KIS API 설정 정보가 없습니다." }, { status: 500 });
    }

    const CANO = queryCano || String(KIS_CONFIG.my_acct_stock);
    const ACNT_PRDT_CD = (queryPrdt || String(KIS_CONFIG.my_prod)).padStart(2, '0');
    const URL_BASE = KIS_CONFIG.prod || KIS_REAL_BASE_URL;

    // 계좌 정용 키 가져오기
    const { appkey, appsecret } = getAccountKeys(CANO);

    try {
        // 1. KIS 인증 토큰 발급 (캐싱 전략 사용)
        let accessToken = await getKisToken(appkey, appsecret);

        // 2. 실전투자 해외 주식 잔고조회 호출 (inquire_balance)
        const tr_id = 'JTTT3012R'; // 해외주식 잔고 (실전)
        const apiPath = '/uapi/overseas-stock/v1/trading/inquire-balance';
        const queryParams = `CANO=${CANO}&ACNT_PRDT_CD=${ACNT_PRDT_CD}&OVRS_EXCG_CD=NASD&TR_CRCY_CD=USD&CTX_AREA_FK200=&CTX_AREA_NK200=`;

        const callApi = async (token: string) => {
            return fetch(`${URL_BASE}${apiPath}?${queryParams}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'authorization': `Bearer ${token}`,
                    'appkey': appkey,
                    'appsecret': appsecret,
                    'tr_id': tr_id,
                }
            });
        };

        let balanceRes = await callApi(accessToken);
        let balanceData = await balanceRes.json();

        // 토큰 만료 에러(EGW00123) 발생 시 1회 강제 갱신 후 재시도
        if (balanceData.msg_cd === 'EGW00123') {
            console.log(`[Overseas Balance API] Token expired for ${CANO}. Refreshing and retrying...`);
            accessToken = await getKisToken(appkey, appsecret, 0, true);
            balanceRes = await callApi(accessToken);
            balanceData = await balanceRes.json();
        }

        console.log(`[Overseas Balance API] KIS Response for ${CANO}:`, balanceData.rt_cd, balanceData.msg_cd, balanceData.msg1);
        return NextResponse.json(balanceData);

    } catch (error: any) {
        console.error("API Proxy Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
