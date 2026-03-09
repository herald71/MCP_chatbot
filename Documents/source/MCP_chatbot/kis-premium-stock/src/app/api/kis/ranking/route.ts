import { NextResponse } from 'next/server';
import { KIS_CONFIG, KIS_REAL_BASE_URL, getKisToken } from '../kisApi';

export async function GET(request: Request) {
    if (!KIS_CONFIG) {
        return NextResponse.json({ error: "설정 정보 없음" }, { status: 500 });
    }

    const APP_KEY = KIS_CONFIG.my_app;
    const APP_SECRET = KIS_CONFIG.my_sec;
    const URL_BASE = KIS_CONFIG.prod || KIS_REAL_BASE_URL;

    try {
        const access_token = await getKisToken();

        // 실전투자 거래량 순위조회 TR_ID: FHPST01710000
        // Parameters for getting top volumes in KRX
        const searchParams = new URLSearchParams({
            FID_COND_MRKT_DIV_CODE: 'J',
            FID_COND_SCR_DIV_CODE: '20171',
            FID_INPUT_ISCD: '0000',
            FID_DIV_CLS_CODE: '0',
            FID_BLNG_CLS_CODE: '0',
            FID_TRGT_CLS_CODE: '111111111',
            FID_TRGT_EXLS_CLS_CODE: '1111110000',
            FID_INPUT_PRICE_1: '',
            FID_INPUT_PRICE_2: '',
            FID_VOL_CNT: '',
            FID_INPUT_DATE_1: ''
        });

        const res = await fetch(`${URL_BASE}/uapi/domestic-stock/v1/quotations/volume-rank?${searchParams.toString()}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'authorization': `Bearer ${access_token}`,
                'appkey': APP_KEY,
                'appsecret': APP_SECRET,
                'tr_id': 'FHPST01710000',
                'custtype': 'P',
            }
        });

        if (!res.ok) {
            const errorBody = await res.text();
            throw new Error(`랭킹 API 오류: ${errorBody}`);
        }

        const data = await res.json();
        return NextResponse.json(data);

    } catch (error: any) {
        console.error("Ranking Proxy Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
