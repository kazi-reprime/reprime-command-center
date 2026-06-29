/**
 * Embeddings helper using OpenAI text-embedding-3-small (1536 dim) or Gemini text-embedding-004 (padded to 1536 dim),
 * falling back to a deterministic pseudo-random unit vector if API keys are missing/unconfigured.
 */

export async function getEmbedding(text: string): Promise<number[]> {
  const cleanText = text.replace(/\n/g, ' ');

  // 1. Try OpenAI if key is present
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'mock') {
    try {
      const res = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          input: cleanText,
          model: 'text-embedding-3-small',
        }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data?.[0]?.embedding) {
          return json.data[0].embedding;
        }
      }
    } catch (e) {
      console.warn('OpenAI embedding generation failed, falling back:', e);
    }
  }

  // 2. Try Gemini if GEMINI_API_KEY is present
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && geminiKey !== 'mock') {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'models/text-embedding-004',
            content: { parts: [{ text: cleanText }] },
          }),
        }
      );
      if (res.ok) {
        const json = await res.json();
        const emb = json.embedding?.values;
        if (Array.isArray(emb)) {
          // Pad 768 dimensions to 1536 dimensions
          const padded = [...emb, ...new Array(1536 - emb.length).fill(0)];
          return padded;
        }
      }
    } catch (e) {
      console.warn('Gemini embedding generation failed, falling back:', e);
    }
  }

  // 3. Fallback to deterministic pseudo-random unit vector
  return getDeterministicMockEmbedding(cleanText);
}

function getDeterministicMockEmbedding(text: string, dimensions = 1536): number[] {
  const vector: number[] = [];
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  for (let i = 0; i < dimensions; i++) {
    const seed = Math.sin(hash + i) * 10000;
    vector.push(seed - Math.floor(seed));
  }
  // Normalize vector to unit length
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  return vector.map((val) => val / (magnitude || 1));
}
