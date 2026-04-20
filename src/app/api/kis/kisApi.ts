import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

// 실전투자(real) 환경용 YAML 파일에서 설정값 로드
const findConfig = () => {
    const possiblePaths = [
        path.resolve(process.cwd(), 'kis_devlp.yaml'), // 현재 작업 디렉토리 (가장 권장됨)
        'c:/Users/owner/Documents/source/MCP_chatbot/kis_devlp.yaml', // 현재 사용자 경로
        'c:/Users/01999/Documents/source/OpenAPI_trading/kis_devlp.yaml',
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
if (configPath) {
    try {
        const fileContents = fs.readFileSync(configPath, 'utf8');
        configInfo = yaml.load(fileContents);
    } catch (e: any) {
        console.error(`[KIS Config] YAML 로드 실패 (${configPath}):`, e.message);
    }
}

export const KIS_REAL_BASE_URL = 'https://openapi.koreainvestment.com:9443';
export const KIS_CONFIG = configInfo;

// 메모리 전역 캐싱 (동시 요청 병합 적용)
let cachedToken: string | null = null;
let tokenExpiresAt: number = 0; // ms
let tokenFetchPromise: Promise<string> | null = null;

const tokenCachePath = path.resolve('.kis_token.json');

export async function getKisToken(retryCount = 0): Promise<string> {
    const now = Date.now();

    // 1. 파일 캐시 확인 (다중 프로세스/스레드 공유용)
    try {
        if (fs.existsSync(tokenCachePath)) {
            const cache = JSON.parse(fs.readFileSync(tokenCachePath, 'utf8'));
            if (cache.token && cache.expiresAt > now) {
                return cache.token;
            }
        }
    } catch (e) {
        console.error("Token cache read error:", e);
    }

    // 2. 캐시 메모리 확인 (단일 스레드 최적화)
    if (cachedToken && now < tokenExpiresAt) {
        return cachedToken;
    }
    if (tokenFetchPromise) {
        return tokenFetchPromise;
    }

    const fetchToken = async () => {
        if (!configInfo) throw new Error("KIS API 설정 정보가 없습니다.");

        const APP_KEY = configInfo.my_app;
        const APP_SECRET = configInfo.my_sec;
        const URL_BASE = configInfo.prod || KIS_REAL_BASE_URL;

        const res = await fetch(`${URL_BASE}/oauth2/tokenP`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                grant_type: 'client_credentials',
                appkey: APP_KEY,
                appsecret: APP_SECRET,
            })
        });

        if (!res.ok) {
            const errText = await res.text();
            // 동시 발급 초과(EGW00133) 회피 로직
            if (errText.includes('EGW00133') && retryCount < 5) {
                console.log(`[Token] EGW00133 발생. 1초 대기 후 폴링 재시도 (${retryCount + 1}/5)...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                return getKisToken(retryCount + 1);
            }
            throw new Error(`토큰 발급 실패: ${errText}`);
        }

        const data = await res.json();
        const access_token = data.access_token;
        const expiresAt = now + (data.expires_in * 1000) - 60000;

        cachedToken = access_token;
        tokenExpiresAt = expiresAt;

        // 파일 캐시에 기록
        try {
            fs.writeFileSync(tokenCachePath, JSON.stringify({ token: access_token, expiresAt }), 'utf8');
        } catch (e) {
            console.error("Token cache write error:", e);
        }

        return access_token;
    };

    tokenFetchPromise = fetchToken().finally(() => {
        tokenFetchPromise = null;
    });

    return tokenFetchPromise;
}
