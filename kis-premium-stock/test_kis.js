const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const axios = require('axios');

async function testKis() {
    const configPath = path.resolve('..', '..', 'OpenAPI_trading', 'kis_devlp.yaml');
    console.log("Loading config from:", configPath);
    let config;
    try {
        const fileContent = fs.readFileSync(configPath, 'utf8');
        config = yaml.load(fileContent);
    } catch (e) {
        console.error("Config File Error:", e.message);
        return;
    }

    const APP_KEY = config.my_app;
    const APP_SECRET = config.my_sec;
    const URL_BASE = config.prod || 'https://openapi.koreainvestment.com:9443';

    // 1. Get Token
    console.log("Fetching token...");
    let token;
    try {
        const res = await axios.post(`${URL_BASE}/oauth2/tokenP`, {
            grant_type: 'client_credentials',
            appkey: APP_KEY,
            appsecret: APP_SECRET,
        });
        token = res.data.access_token;
        console.log("Token obtained successfully.");
    } catch (e) {
        console.error("Token Error:", e.response ? e.response.data : e.message);
        return;
    }

    // 2. Inquire Price (Samsung Electronics 005930)
    console.log("Inquiring price for Samsung Electronics (005930)...");
    try {
        const res = await axios.get(`${URL_BASE}/uapi/domestic-stock/v1/quotations/inquire-price`, {
            params: {
                FID_COND_MRKT_DIV_CODE: 'J',
                FID_INPUT_ISCD: '005930'
            },
            headers: {
                'authorization': `Bearer ${token}`,
                'appkey': APP_KEY,
                'appsecret': APP_SECRET,
                'tr_id': 'FHKST01010100',
            }
        });
        console.log("Price Inquiry Status:", res.status);
        console.log("Current Price:", res.data.output.stck_prpr);
    } catch (e) {
        console.error("Price Inquiry Error:", e.response ? e.response.data : e.message);
    }
}
testKis();
