import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    
    if (!query) {
      return NextResponse.json({ results: [] });
    }

    // Mock pgvector semantic search results for UI prototyping
    const mockResults = [
      {
        id: 'memory-1',
        type: 'message',
        source: 'WhatsApp',
        snippet: `I mentioned the $4.2M loan structure to the investors yesterday.`,
        date: '2026-06-28T14:30:00Z',
        score: 0.95
      },
      {
        id: 'memory-2',
        type: 'email',
        source: 'Gmail',
        snippet: `Attached is the revised settlement agreement for Bay Valley.`,
        date: '2026-06-25T09:15:00Z',
        score: 0.88
      }
    ];

    return NextResponse.json({ results: mockResults, query });
  } catch (error) {
    console.error('Failed to search memory:', error);
    return NextResponse.json({ error: 'Failed to search memory' }, { status: 500 });
  }
}
