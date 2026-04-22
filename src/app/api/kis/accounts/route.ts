import { NextResponse } from 'next/server';
import { KIS_ACCOUNTS, KIS_CONFIG } from '../kisApi';

export async function GET() {
    if (!KIS_CONFIG) {
        return NextResponse.json({ error: "KIS API 설정 정보가 없습니다." }, { status: 500 });
    }

    return NextResponse.json(KIS_ACCOUNTS);
}
