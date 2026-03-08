import { NextResponse } from 'next/server';
import { getKisToken, KIS_CONFIG, KIS_REAL_BASE_URL } from '../kisApi';

export async function GET() {
    if (!KIS_CONFIG) {
        return NextResponse.json({ error: "KIS API 설정 정보가 없습니다." }, { status: 500 });
    }
    const APP_KEY = KIS_CONFIG.my_app;
    const APP_SECRET = KIS_CONFIG.my_sec;
    const CANO = String(KIS_CONFIG.my_acct_stock);
    const ACNT_PRDT_CD = String(KIS_CONFIG.my_prod).padStart(2, '0');
    const URL_BASE = KIS_CONFIG.prod || KIS_REAL_BASE_URL;

    try {
        // 1. KIS 인증 토큰 발급 (캐싱 전략 사용)
        const accessToken = await getKisToken();

        // 2. 실전투자 해외 주식 잔고조회 호출 (inquire_balance)
        const tr_id = 'JTTT3012R'; // 해외주식 잔고 (실전)

        const balanceRes = await fetch(`${URL_BASE}/uapi/overseas-stock/v1/trading/inquire-balance?CANO=${CANO}&ACNT_PRDT_CD=${ACNT_PRDT_CD}&OVRS_EXCG_CD=NASD&TR_CRCY_CD=USD&CTX_AREA_FK200=&CTX_AREA_NK200=`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'authorization': `Bearer ${accessToken}`,
                'appkey': APP_KEY,
                'appsecret': APP_SECRET,
                'tr_id': tr_id,
            }
        });

        if (!balanceRes.ok) {
            const errText = await balanceRes.text();
            throw new Error(`해외 잔고 조회 API 호출 실패: ${errText}`);
        }
        const balanceData = await balanceRes.json();

        return NextResponse.json(balanceData);

    } catch (error: any) {
        console.error("API Proxy Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
