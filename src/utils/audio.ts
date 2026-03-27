import { generateSpeech } from '../services/gemini';

let audioContext: AudioContext | null = null;

export const playHighQualityAudio = async (text: string, lang: string = 'en-US'): Promise<void> => {
  if (!text || !text.trim()) return;
  
  console.log('Generating audio for:', text);
  try {
    // Use different voices based on language if needed, but Kore is good for English
    const voiceName = lang === 'zh-CN' ? 'Puck' : 'Kore';
    
    const base64Audio = await generateSpeech(text, voiceName);
    
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    // Resume context if suspended (browser autoplay policy)
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    const binaryString = window.atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Convert 16-bit PCM to Float32
    const float32Data = new Float32Array(bytes.length / 2);
    const dataView = new DataView(bytes.buffer);
    for (let i = 0; i < float32Data.length; i++) {
      // 16-bit signed integer, little-endian
      const int16 = dataView.getInt16(i * 2, true);
      float32Data[i] = int16 < 0 ? int16 / 32768 : int16 / 32767;
    }
    
    const sampleRate = 24000;
    const audioBuffer = audioContext.createBuffer(1, float32Data.length, sampleRate);
    audioBuffer.getChannelData(0).set(float32Data);
    
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    
    return new Promise((resolve) => {
      source.onended = () => resolve();
      source.start();
    });
  } catch (error) {
    console.error('Failed to play high quality audio, falling back to browser TTS:', error);
    return new Promise((resolve) => {
      if ('speechSynthesis' in window) {
        const cleanText = text.replace(/___/g, 'blank');
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = lang;
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        window.speechSynthesis.speak(utterance);
      } else {
        resolve();
      }
    });
  }
};
