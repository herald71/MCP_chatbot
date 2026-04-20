import { NextResponse } from 'next/server';
import { KIS_CONFIG, KIS_REAL_BASE_URL, getKisToken } from '../kisApi';

export async function GET(request: Request) {
    if (!KIS_CONFIG) {
        return NextResponse.json({ error: "설정 정보 없음" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const stockCode = searchParams.get('code');

    if (!stockCode) {
        return NextResponse.json({ error: "종목코드(code) 파라미터가 필요합니다." }, { status: 400 });
    }

    const APP_KEY = KIS_CONFIG.my_app;
    const APP_SECRET = KIS_CONFIG.my_sec;
    const URL_BASE = KIS_CONFIG.prod || KIS_REAL_BASE_URL;

    try {
        // 1. 토큰 획득 (공유 캐시 사용)
        const access_token = await getKisToken();

        // 2. 국내주식 현재가 시세 (inquire-price)
        // tr_id: 모의/실전 동일 FHKST01010100
        const priceRes = await fetch(`${URL_BASE}/uapi/domestic-stock/v1/quotations/inquire-price?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=${stockCode}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'authorization': `Bearer ${access_token}`,
                'appkey': APP_KEY,
                'appsecret': APP_SECRET,
                'tr_id': 'FHKST01010100',
            }
        });

        if (!priceRes.ok) {
            const errorBody = await priceRes.text();
            throw new Error(`현재가 API 오류: ${errorBody}`);
        }

        const priceData = await priceRes.json();
        return NextResponse.json(priceData);

    } catch (error: any) {
        console.error("Price Proxy Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
