import { NextResponse } from 'next/server';
import { buildComparePairs, syncCompareSession } from '@/lib/compare-session';

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ compareId: string }> }
) {
    const { compareId } = await params;
    if (!compareId) {
        return NextResponse.json({ error: 'Missing compareId' }, { status: 400 });
    }

    const session = await syncCompareSession(compareId);
    const pairs = await buildComparePairs(compareId);

    return NextResponse.json({
        compareId,
        status: session.status,
        totalCases: session.totalCases,
        completedCases: session.completedCases,
        failedCases: session.failedCases,
        pairs,
    });
}
