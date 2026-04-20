import os
import sys
import yaml
import json
import requests
import datetime
import yfinance as yf

# KIS 설정 파일 경로
CONFIG_PATH = 'c:/Users/01999/Documents/source/OpenAPI_trading/kis_devlp.yaml'
TOKEN_CACHE = '.kis_token.json'

def get_kis_config():
    if not os.path.exists(CONFIG_PATH):
        raise FileNotFoundError(f"KIS 설정 파일을 찾을 수 없습니다: {CONFIG_PATH}")
    with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)

def get_access_token(config):
    now = datetime.datetime.now()
    if os.path.exists(TOKEN_CACHE):
        try:
            with open(TOKEN_CACHE, 'r', encoding='utf-8') as f:
                cache = json.load(f)
                expires_at = datetime.datetime.fromtimestamp(cache.get('expiresAt', 0) / 1000)
                if expires_at > now:
                    return cache['token']
        except: pass
    
    url = f"{config['prod']}/oauth2/tokenP"
    payload = {"grant_type": "client_credentials", "appkey": config['my_app'], "appsecret": config['my_sec']}
    res = requests.post(url, json=payload)
    res.raise_for_status()
    data = res.json()
    access_token = data['access_token']
    expires_at_ms = (datetime.datetime.now().timestamp() + int(data['expires_in']) - 60) * 1000
    with open(TOKEN_CACHE, 'w', encoding='utf-8') as f:
        json.dump({'token': access_token, 'expiresAt': expires_at_ms}, f)
    return access_token

def search_stock_code(config, access_token, query):
    # 단순 종목코드 (6자리 숫자) 인지 확인
    if query.isdigit() and len(query) == 6:
        return query, query
    
    # 종목명으로 코드 검색 (search_info API 활용)
    url = f"{config['prod']}/uapi/domestic-stock/v1/quotations/search-info"
    headers = {
        "Content-Type": "application/json",
        "authorization": f"Bearer {access_token}",
        "appkey": config['my_app'],
        "appsecret": config['my_sec'],
        "tr_id": "CTPF1604R" # 상품정보 조회
    }
    params = {"PDNO": query, "PRDT_TYPE_CD": "300"} # 300: 주식
    res = requests.get(url, headers=headers, params=params)
    if res.ok:
        data = res.json().get('output', [{}])[0]
        if data.get('pdno'):
            # 반환된 pdno는 종목코드 앞에 시장구분 등이 붙을 수 있으므로 뒤 6자리 추출
            code = data.get('pdno')[-6:]
            name = data.get('prdt_abrv_name', query)
            return code, name
            
    return None, query

def get_kis_stock_data(config, access_token, stock_code):
    url = f"{config['prod']}/uapi/domestic-stock/v1/quotations/inquire-price"
    headers = {
        "Content-Type": "application/json",
        "authorization": f"Bearer {access_token}",
        "appkey": config['my_app'],
        "appsecret": config['my_sec'],
        "tr_id": "FHKST01010100"
    }
    params = {"FID_COND_MRKT_DIV_CODE": "J", "FID_INPUT_ISCD": stock_code}
    res = requests.get(url, headers=headers, params=params)
    res.raise_for_status()
    return res.json().get('output', {})

def get_yahoo_data(stock_code):
    ticker = f"{stock_code}.KS"
    stock = yf.Ticker(ticker)
    info = stock.info
    return {
        "forward_per": info.get("forwardPE"),
        "roe": info.get("returnOnEquity"),
        "op_margin": info.get("operatingMargins"),
        "debt_ratio": info.get("debtToEquity")
    }

def format_value(val, unit="", is_percent=False):
    if val is None or val == "" or val == "N/A": return "N/A"
    try:
        clean_val = str(val).replace(",", "").strip()
        num = float(clean_val)
        if is_percent:
            if abs(num) < 2: return f"{num * 100:.2f}%"
            return f"{num:.2f}%"
        if abs(num) >= 1000: return f"{int(num):,}{unit}"
        return f"{num:.2f}{unit}"
    except: return val

def main():
    # 1. 입력값 처리 (명령행 인자 또는 직접 입력)
    if len(sys.argv) > 1:
        query = " ".join(sys.argv[1:])
    else:
        query = input("분석할 종목명 또는 코드를 입력하세요: ").strip()
    
    if not query:
        print("❌ 종목명 또는 코드를 입력해야 합니다.")
        return

    try:
        config = get_kis_config()
        token = get_access_token(config)
        
        # 2. 종목 검색 및 코드 확정
        print(f"🔍 '{query}' 검색 중...")
        stock_code, stock_name = search_stock_code(config, token, query)
        
        if not stock_code:
            print(f"❌ '{query}'에 해당하는 종목을 찾을 수 없습니다.")
            return

        print(f"🔄 {stock_name} ({stock_code}) 데이터 수집 중...")
        kis_data = get_kis_stock_data(config, token, stock_code)
        yahoo_data = get_yahoo_data(stock_code)
        
        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        report = f"""
🌟 [{stock_name}] 초종합 재무 분석 리포트
📅 일시: {now_str}

💰 주가 및 가치지표 (KIS)
• 현재가: {format_value(kis_data.get('stck_prpr'), '원')}
• TTM PER: {format_value(kis_data.get('per'))} | PBR: {format_value(kis_data.get('pbr'))}
• EPS: {format_value(kis_data.get('eps'), '원')} | BPS: {format_value(kis_data.get('bps'), '원')}
• 배당수익률: N/A% (KIS 데이터 미제공)

🚀 성장성 및 수익성 (Yahoo)
• 예상 PER (Forward): {format_value(yahoo_data.get('forward_per'))}
• ROE: {format_value(yahoo_data.get('roe'), is_percent=True)}
• 영업이익률: {format_value(yahoo_data.get('op_margin'), is_percent=True)}
• ROIC: N/A

🛡️ 재무 건전성 (Yahoo)
• 부채비율: {format_value(yahoo_data.get('debt_ratio'), is_percent=True)}
"""
        print(report)
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")

if __name__ == "__main__":
    main()
