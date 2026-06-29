/**
 * Voice Client wrapper for Groq Whisper Large v3 (STT) and ElevenLabs Flash 2.5 (TTS).
 */

export async function transcribeAudio(audioBlob: Blob, language?: 'en' | 'he'): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY environment variable is missing.');
  }

  const formData = new FormData();
  const file = new File([audioBlob], 'speech.wav', { type: audioBlob.type || 'audio/wav' });
  formData.append('file', file);
  formData.append('model', 'whisper-large-v3');
  if (language) {
    formData.append('language', language);
  }

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq Whisper transcription failed: ${errText}`);
  }

  const data = await res.json();
  return data.text || '';
}

export async function textToSpeech(text: string, voiceId = '21m00Tcm4TlvDq8ikWAM'): Promise<ArrayBuffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY environment variable is missing.');
  }

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_flash_v2_5', // ElevenLabs low latency Flash 2.5 model
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ElevenLabs TTS failed: ${errText}`);
  }

  return await res.arrayBuffer();
}
