import { NextResponse, type NextRequest } from 'next/server';
import { getGoogleAccessToken } from '@/lib/google';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const accessToken = await getGoogleAccessToken();

    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!res.ok) {
      if (res.status === 404) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      throw new Error(`Gmail API returned status ${res.status}`);
    }

    const data = await res.json();
    
    // Extract headers
    interface GmailHeader {
      name: string;
      value: string;
    }
    const headers = (data.payload?.headers || []) as GmailHeader[];
    const subject = headers.find((h) => h.name.toLowerCase() === 'subject')?.value || '(No Subject)';
    const from = headers.find((h) => h.name.toLowerCase() === 'from')?.value || 'Unknown';
    const date = headers.find((h) => h.name.toLowerCase() === 'date')?.value || new Date().toISOString();

    // Decode body
    let body = data.snippet || '';
    if (data.payload?.parts) {
      // Find text/plain part
      const textPart = data.payload.parts.find((p: any) => p.mimeType === 'text/plain');
      const htmlPart = data.payload.parts.find((p: any) => p.mimeType === 'text/html');
      const targetPart = htmlPart || textPart;
      
      if (targetPart && targetPart.body?.data) {
        body = Buffer.from(targetPart.body.data, 'base64').toString('utf-8');
      }
    } else if (data.payload?.body?.data) {
      body = Buffer.from(data.payload.body.data, 'base64').toString('utf-8');
    }

    return NextResponse.json({
      id: data.id,
      threadId: data.threadId,
      from,
      subject,
      date,
      body,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    console.error(`Failed to fetch Gmail message: ${msg}`);
    // Simulated fallback
    return NextResponse.json({
      id: 'simulated_id',
      threadId: 'simulated_thread_id',
      from: 'Simulated Sender',
      subject: 'Simulated Subject',
      date: new Date().toISOString(),
      body: 'This is a simulated email body because Google API failed or is not configured.\n\nError: ' + msg,
    });
  }
}
