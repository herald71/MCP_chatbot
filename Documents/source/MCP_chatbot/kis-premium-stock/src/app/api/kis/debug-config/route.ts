import { NextResponse } from 'next/server';
import { KIS_CONFIG } from '../kisApi';

export async function GET() {
    return NextResponse.json({
        config_loaded: !!KIS_CONFIG,
        config_keys: KIS_CONFIG ? Object.keys(KIS_CONFIG).filter(k => !k.includes('sec') && !k.includes('app')) : [],
        working_directory: process.cwd(),
        node_env: process.env.NODE_ENV
    });
}
