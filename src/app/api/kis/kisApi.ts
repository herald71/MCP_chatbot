import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import crypto from 'crypto';

// 실전투자(real) 환경용 YAML 파일에서 설정값 로드
const findConfig = () => {
    const possiblePaths = [
        path.resolve(process.cwd(), 'kis_devlp.yaml'), // 현재 작업 디렉토리
        'c:/Users/owner/Documents/source/MCP_chatbot/kis_devlp.yaml', // 현재 사용자 경로
        'c:/Users/01999/Documents/source/OpenAPI_trading/kis_devlp.yaml', // 대체 경로
        path.resolve(process.cwd(), '..', '..', 'OpenAPI_trading', 'kis_devlp.yaml'),
    ];

    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            console.log(`[KIS Config] Found config at: ${p}`);
            return p;
        }
    }
    console.warn(`[KIS Config] Could not find kis_devlp.yaml in searched paths: ${possiblePaths.join(', ')}`);
    return null;
};

const configPath = findConfig();

let configInfo: any = null;
let accounts: { name: string, cano: string, prdt: string, appkey?: string, appsecret?: string }[] = [];

if (configPath) {
    try {
        const fileContents = fs.readFileSync(configPath, 'utf8');
        configInfo = yaml.load(fileContents);

        if (configInfo) {
            // 여러 계좌 정보 처리
            if (Array.isArray(configInfo.accounts)) {
                accounts = configInfo.accounts.map((acc: any) => ({
                    name: String(acc.name || '계좌'),
                    cano: String(acc.cano),
                    prdt: String(acc.prdt || '01').padStart(2, '0'),
                    appkey: acc.appkey,
                    appsecret: acc.appsecret
                }));
            } else if (configInfo.my_acct_stock) {
                // 기존 단일 계좌 설정이 있을 경우 기본값으로 추가
                accounts = [{
                    name: '기본 계좌',
                    cano: String(configInfo.my_acct_stock),
                    prdt: String(configInfo.my_prod || '01').padStart(2, '0')
                }];
            }
        }
    } catch (e: any) {
        console.error(`[KIS Config] YAML 로드 실패 (${configPath}):`, e.message);
    }
}

export const KIS_REAL_BASE_URL = 'https://openapi.koreainvestment.com:9443';
export const KIS_CONFIG = configInfo;
export const KIS_ACCOUNTS = accounts;

/**
 * 특정 계좌번호에 맞는 AppKey와 AppSecret을 반환합니다.
 * 계좌 전용 키가 없으면 글로벌 키(my_app, my_sec)를 반환합니다.
 */
export function getAccountKeys(cano: string) {
    const acc = accounts.find(a => a.cano === cano);
    if (acc && acc.appkey && acc.appsecret) {
        return { appkey: acc.appkey, appsecret: acc.appsecret };
    }
    return {
        appkey: configInfo?.my_app,
        appsecret: configInfo?.my_sec
    };
}

// 메모리 캐싱 (앱키별로 관리)
const cachedTokens: Record<string, { token: string, expiresAt: number }> = {};
const tokenFetchPromises: Record<string, Promise<string> | null> = {};

export async function getKisToken(appkey?: string, appsecret?: string, retryCount = 0, forceRefresh = false): Promise<string> {
    const finalKey = appkey || configInfo?.my_app;
    const finalSecret = appsecret || configInfo?.my_sec;

    if (!finalKey || !finalSecret) {
        throw new Error("KIS API AppKey 또는 AppSecret이 없습니다.");
    }

    const keyHash = crypto.createHash('md5').update(finalKey).digest('hex').substring(0, 8);
    const tokenCachePath = path.resolve(`.kis_token_${keyHash}.json`);
    const now = Date.now();

    if (!forceRefresh) {
        // 1. 파일 캐시 확인
        try {
            if (fs.existsSync(tokenCachePath)) {
                const cache = JSON.parse(fs.readFileSync(tokenCachePath, 'utf8'));
                if (cache.token && cache.expiresAt > now) {
                    return cache.token;
                }
            }
        } catch (e) {
            console.error(`Token cache read error (${keyHash}):`, e);
        }

        // 2. 메모리 캐시 확인
        if (cachedTokens[keyHash] && now < cachedTokens[keyHash].expiresAt) {
            return cachedTokens[keyHash].token;
        }
        if (tokenFetchPromises[keyHash]) {
            return tokenFetchPromises[keyHash]!;
        }
    } else {
        console.log(`[KIS API] Force refreshing token for ${keyHash}...`);
    }

    const fetchToken = async () => {
        const URL_BASE = configInfo?.prod || KIS_REAL_BASE_URL;

        const res = await fetch(`${URL_BASE}/oauth2/tokenP`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                grant_type: 'client_credentials',
                appkey: finalKey,
                appsecret: finalSecret,
            })
        });

        if (!res.ok) {
            const errText = await res.text();
            if (errText.includes('EGW00133') && retryCount < 5) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                return getKisToken(finalKey, finalSecret, retryCount + 1);
            }
            throw new Error(`토큰 발급 실패: ${errText}`);
        }

        const data = await res.json();
        const access_token = data.access_token;
        const expiresAt = now + (data.expires_in * 1000) - 60000;

        cachedTokens[keyHash] = { token: access_token, expiresAt };

        try {
            fs.writeFileSync(tokenCachePath, JSON.stringify({ token: access_token, expiresAt }), 'utf8');
        } catch (e) {
            console.error("Token cache write error:", e);
        }

        return access_token;
    };

    tokenFetchPromises[keyHash] = fetchToken().finally(() => {
        tokenFetchPromises[keyHash] = null;
    });

    return tokenFetchPromises[keyHash]!;
}
