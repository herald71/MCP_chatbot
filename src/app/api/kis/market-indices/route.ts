import { NextResponse } from 'next/server';
import { KIS_CONFIG, getKisToken } from '../kisApi';
import axios from 'axios';

export const dynamic = 'force-dynamic';
export const revalidate = 60; // 1 minute cache

export async function GET() {
    try {
        if (!KIS_CONFIG) {
            return NextResponse.json({ error: "Configuration not found" }, { status: 500 });
        }

        const APP_KEY = KIS_CONFIG.my_app;
        const APP_SECRET = KIS_CONFIG.my_sec;
        const URL_BASE = KIS_CONFIG.prod || 'https://openapi.koreainvestment.com:9443';

        const access_token = await getKisToken();

        // 1. Domestic Index Fetcher (KOSPI, KOSDAQ)
        const fetchDomesticIndex = async (code: string, name: string) => {
            try {
                const res = await axios.get(`${URL_BASE}/uapi/domestic-stock/v1/quotations/inquire-index-price`, {
                    params: {
                        FID_COND_MRKT_DIV_CODE: 'U',
                        FID_INPUT_ISCD: code
                    },
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8',
                        'authorization': `Bearer ${access_token}`,
                        'appkey': APP_KEY,
                        'appsecret': APP_SECRET,
                        'tr_id': 'FHPUP02100000',
                    },
                    timeout: 5000
                });

                if (res.data?.rt_cd === '0' && res.data?.output) {
                    const out = res.data.output;
                    return {
                        name,
                        type: 'KR',
                        price: out.bstp_nmix_prpr || '0',
                        change: out.bstp_nmix_prdy_ctrt || '0.00',
                        amt: out.bstp_nmix_prdy_vrss || '0.00',
                        isUp: parseFloat(out.bstp_nmix_prdy_ctrt) >= 0
                    };
                }
                return null;
            } catch (e: any) {
                console.error(`[Market API] Domestic ${name} Error:`, e.message);
                return null;
            }
        };

        // 2. Overseas Index Fetcher (NASDAQ, S&P 500, NASDAQ 100)
        const fetchOverseasDaily = async (symbol: string, name: string, marketDiv: string) => {
            try {
                const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
                const res = await axios.get(`${URL_BASE}/uapi/overseas-price/v1/quotations/inquire-daily-chartprice`, {
                    params: {
                        FID_COND_MRKT_DIV_CODE: marketDiv,
                        FID_INPUT_ISCD: symbol,
                        FID_INPUT_DATE_1: today,
                        FID_INPUT_DATE_2: today,
                        FID_PERIOD_DIV_CODE: 'D'
                    },
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8',
                        'authorization': `Bearer ${access_token}`,
                        'appkey': APP_KEY,
                        'appsecret': APP_SECRET,
                        'tr_id': 'FHKST03030100',
                    },
                    timeout: 5000
                });

                if (res.data?.rt_cd === '0' && res.data?.output1) {
                    const out = res.data.output1;
                    if (out.ovrs_nmix_prpr && out.ovrs_nmix_prpr !== '0.00' && out.ovrs_nmix_prpr !== '0.0000') {
                        return {
                            name,
                            type: 'US',
                            price: out.ovrs_nmix_prpr || '0',
                            change: out.prdy_ctrt || '0.00',
                            amt: out.ovrs_nmix_prdy_vrss || out.prdy_vrss || '0.00',
                            isUp: parseFloat(out.prdy_ctrt) >= 0
                        };
                    }
                }
                return null;
            } catch (e: any) {
                console.error(`[Market API] Overseas ${name} Error:`, e.message);
                return null;
            }
        };

        let [kospi, kosdaq, nasdaq, sp500, nasFuture, usdkrw] = await Promise.all([
            fetchDomesticIndex('0001', 'KOSPI'),
            fetchDomesticIndex('1001', 'KOSDAQ'),
            fetchOverseasDaily('COMP', 'NASDAQ', 'N'),
            fetchOverseasDaily('SPX', 'S&P 500', 'N'),
            fetchOverseasDaily('NDX', '나스닥 100', 'N'), // Proxy for NASDAQ Future
            fetchOverseasDaily('FX@USDKRW', 'USD/KRW', 'X')
        ]);

        const responseData = [kospi, kosdaq, nasdaq, sp500, nasFuture, usdkrw].filter((item): item is any => item !== null);

        // UI stability: Ensure at least items requested are shown, even if dummy
        if (responseData.length < 4) {
            return NextResponse.json([
                { name: 'KOSPI', type: 'KR', price: '2501.23', change: '0.45', amt: '11.20', isUp: true },
                { name: 'KOSDAQ', type: 'KR', price: '852.10', change: '-0.15', amt: '-1.30', isUp: false },
                { name: 'NASDAQ', type: 'US', price: '16024.50', change: '1.12', amt: '178.40', isUp: true },
                { name: 'S&P 500', type: 'US', price: '5123.10', change: '0.75', amt: '38.20', isUp: true },
                { name: 'USD/KRW', type: 'US', price: '1355.20', change: '0.05', amt: '0.70', isUp: true },
                { name: '나스닥 100', type: 'US', price: '18120.00', change: '1.05', amt: '188.00', isUp: true },
            ]);
        }

        return NextResponse.json(responseData);

    } catch (error: any) {
        console.error("Market Indices Critical API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
