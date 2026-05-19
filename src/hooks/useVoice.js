export async function falarTexto(texto, opcoes = {}) {
  if (!texto?.trim()) return

  try {
    // Tenta TTS via OpenRouter
    const resposta = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        texto: texto.slice(0, 4096), // limite de segurança
        voz: opcoes.voz || 'alloy'
      })
    })

    if (!resposta.ok) throw new Error('TTS falhou')

    const blob = await resposta.blob()
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)

    // Limpa URL após reprodução
    audio.onended = () => URL.revokeObjectURL(url)
    await audio.play()

    return audio

  } catch (erro) {
    // Reserva para Web Speech API nativa
    console.warn('[TTS] OpenRouter falhou, usando SpeechSynthesis:', erro)
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(texto)
      utterance.lang = 'pt-PT'
      utterance.rate = 0.9
      speechSynthesis.speak(utterance)
    }
  }
}

export async function transcreverWhisper(audioBlob) {
  const buffer = await audioBlob.arrayBuffer()
  const base64 = btoa(
    String.fromCharCode(...new Uint8Array(buffer))
  )

  const resposta = await fetch('/api/stt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audio: base64,
      formato: 'webm',
      idioma: 'pt'
    })
  })

  const dados = await resposta.json()
  return dados.text || ''
}

export async function ouvirMicrofone(setInput, setAviso) {
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const sr = new SR();
    sr.lang = 'pt-PT';
    sr.interimResults = false;
    sr.maxAlternatives = 1;
    sr.onresult = e => {
      const t = e.results[0][0].transcript;
      setInput(p => p ? p + " " + t : t);
    };
    sr.onerror = () => setAviso && setAviso("Erro na voz", "error");
    sr.start();
    return;
  }

  // Reserva para OpenRouter Whisper
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    const audioChunks = [];

    mediaRecorder.ondataavailable = event => {
      if (event.data.size > 0) audioChunks.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      if (setAviso) setAviso("A transcrever...", "info");
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      try {
        const text = await transcreverWhisper(audioBlob);
        if (text) setInput(p => p ? p + " " + text : text);
      } catch (e) {
        if (setAviso) setAviso("Erro ao transcrever com Whisper", "error");
      } finally {
        stream.getTracks().forEach(track => track.stop());
      }
    };

    mediaRecorder.start();
    if (setAviso) setAviso("A ouvir... (toca novamente para parar)", "info");

    // Retorna função de paragem para controlo manual pelo chamador
    return () => {
      if (mediaRecorder.state === 'recording') mediaRecorder.stop();
    };

  } catch (err) {
    if (setAviso) setAviso("Acesso ao microfone negado", "error");
  }
}
