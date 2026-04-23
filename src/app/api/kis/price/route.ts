import { NextResponse } from 'next/server';
import { KIS_CONFIG, KIS_REAL_BASE_URL, getKisToken } from '../kisApi';
import fs from 'fs';

export async function GET(request: Request) {
    if (!KIS_CONFIG) {
        return NextResponse.json({ error: "설정 정보 없음" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const stockCode = searchParams.get('code');
    const type = searchParams.get('type') || 'KR'; // 'KR' or 'US'
    const excdParam = searchParams.get('excd');

    if (stockCode === 'DEBUG' && type === 'ITEMS') {
        const fs = require('fs');
        const logFile = 'c:/Users/01999/Documents/source/MCP_chatbot/kis-premium-stock/kis_price_trace.txt';
        const count = searchParams.get('count');
        const codes = searchParams.get('codes');
        try {
            fs.appendFileSync(logFile, `[${new Date().toISOString()}] DEBUG ITEMS: Count=${count} Codes=${codes}\n`);
        } catch (e) { }
        return NextResponse.json({ success: true });
    }

    if (!stockCode) {
        return NextResponse.json({ error: "종목코드(code) 파라미터가 필요합니다." }, { status: 400 });
    }

    const APP_KEY = KIS_CONFIG.my_app;
    const APP_SECRET = KIS_CONFIG.my_sec;
    const URL_BASE = KIS_CONFIG.prod || KIS_REAL_BASE_URL;
    const logFile = 'c:/Users/01999/Documents/source/MCP_chatbot/kis-premium-stock/kis_price_trace.txt';

    try {
        const access_token = await getKisToken();

        let apiURL = '';
        let tr_id = '';

        if (type === 'US') {
            // 해외주식 현재가 시세 (HHDFS00000300)
            let excd = excdParam || 'NAS';
            const excdMap: Record<string, string> = {
                'NASD': 'NAS',
                'NYSE': 'NYS',
                'AMEX': 'AMS'
            };
            if (excdMap[excd]) excd = excdMap[excd];

            apiURL = `${URL_BASE}/uapi/overseas-price/v1/quotations/price?AUTH=&EXCD=${excd}&SYMB=${stockCode}`;
            tr_id = 'HHDFS00000300';
        } else {
            // 국내주식 현재가 시세 (FHKST01010100)
            apiURL = `${URL_BASE}/uapi/domestic-stock/v1/quotations/inquire-price?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=${stockCode}`;
            tr_id = 'FHKST01010100';
        }

        // Trace Request
        try {
            fs.appendFileSync(logFile, `[${new Date().toISOString()}] REQ: ${type} ${stockCode} (EXCD:${excdParam}) TR:${tr_id}\n`);
        } catch (e) { }

        const callApi = async (token: string) => {
            return fetch(apiURL, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'authorization': `Bearer ${token}`,
                    'appkey': APP_KEY,
                    'appsecret': APP_SECRET,
                    'tr_id': tr_id,
                }
            });
        };

        let priceRes = await callApi(access_token);

        if (!priceRes.ok) {
            const errorBody = await priceRes.text();
            
            // 만약 에러 바디에 EGW00123이 포함되어 있다면 토큰 갱신 후 재시도
            if (errorBody.includes('EGW00123')) {
                console.log(`[Price API] Token expired for ${stockCode}. Refreshing and retrying...`);
                const newToken = await getKisToken(undefined, undefined, 0, true);
                priceRes = await callApi(newToken);
                if (!priceRes.ok) {
                    const retryErrorBody = await priceRes.text();
                    try {
                        fs.appendFileSync(logFile, `[${new Date().toISOString()}] ERR: ${stockCode} Status:${priceRes.status} Body:${retryErrorBody}\n`);
                    } catch (e) { }
                    throw new Error(`현재가 API 재시도 오류: ${retryErrorBody}`);
                }
            } else {
                try {
                    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ERR: ${stockCode} Status:${priceRes.status} Body:${errorBody}\n`);
                } catch (e) { }
                throw new Error(`현재가 API 오류: ${errorBody}`);
            }
        }

        const priceData = await priceRes.json();

        // 성공 응답 내에서도 EGW00123이 있을 수 있음
        if (priceData.msg_cd === 'EGW00123') {
            console.log(`[Price API] Token expired in JSON for ${stockCode}. Refreshing and retrying...`);
            const newToken = await getKisToken(undefined, undefined, 0, true);
            const retryRes = await callApi(newToken);
            const retryData = await retryRes.json();
            return NextResponse.json(retryData);
        }

        try {
            fs.appendFileSync(logFile, `[${new Date().toISOString()}] RES: ${stockCode} RT_CD:${priceData.rt_cd} Last:${priceData.output?.last || priceData.output?.stck_prpr}\n`);
        } catch (e) { }

        // 해외/국내 응답 구조 통일
        if (type === 'US' && priceData.output) {
            priceData.output.stck_prpr = priceData.output.last;
            priceData.output.prdy_vrss = priceData.output.diff;
            priceData.output.prdy_ctrt = priceData.output.rate;
        }

        return NextResponse.json(priceData);

    } catch (error: any) {
        console.error("Price Proxy Error:", error);
        try {
            fs.appendFileSync(logFile, `[${new Date().toISOString()}] EXCEPTION: ${stockCode} Msg:${error.message}\n`);
        } catch (e) { }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
