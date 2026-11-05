#!/usr/bin/env python3
"""Gera um áudio por cena a partir do roteiro.json.

Uso: python3 scripts/voz.py [--cenas C05,C09] [--transcrever]

Motores (config.json -> VOZ):
  kokoro     -> Kokoro-82M (offline); voz ou mistura de vozes em config.json (VOZ_OPCOES.kokoro)
  edge       -> edge-tts pt-BR-AntonioNeural (precisa de acesso a speech.platform.bing.com)
  elevenlabs -> API ElevenLabs (chave e voz lidas de variáveis de ambiente)
Saída: audio/Cxx.wav (48 kHz, -16 LUFS / -1.5 dBTP), audio/Cxx.palavras.json, audio/duracoes.json
"""
import argparse, json, os, re, subprocess, sys, tempfile, base64, urllib.request
import numpy as np
import soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CFG = json.load(open(os.path.join(ROOT, 'config.json'), encoding='utf8'))
ROT = json.load(open(os.path.join(ROOT, 'roteiro.json'), encoding='utf8'))
AUD = os.path.join(ROOT, 'audio')
MODELS = os.path.join(ROOT, 'models')
SR = 48000
PAUSA_FRASE = 0.32   # pausa extra após ponto final (entre frases)


def run(cmd, **kw):
    return subprocess.run(cmd, check=True, capture_output=True, text=True, **kw)


def frases(texto):
    return [f.strip() for f in re.split(r'(?<=[.!?])\s+', texto) if f.strip()]


# ---------------- motores ----------------
_kokoro = None
def tts_kokoro(texto, wav_out):
    global _kokoro
    from kokoro_onnx import Kokoro
    if _kokoro is None:
        _kokoro = Kokoro(os.path.join(MODELS, 'kokoro', 'kokoro-q8.onnx'), os.path.join(MODELS, 'kokoro', 'voices-pt.npz'))
    o = CFG['VOZ_OPCOES']['kokoro']
    # "mistura": média ponderada de vozes do Kokoro (ex.: 65% pf_dora + 35% af_heart)
    if o.get('mistura'):
        vs = np.load(os.path.join(MODELS, 'kokoro', 'voices-pt.npz'))
        voz_ = sum(p * vs[n] for n, p in o['mistura'].items()).astype(np.float32)
    else:
        voz_ = o['voz']
    partes = []
    sr = 24000
    for i, f in enumerate(frases(texto)):
        a, sr = _kokoro.create(f, voice=voz_, speed=o['velocidade'], lang='pt-br')
        a = aparar(a, sr)
        partes.append(a)
        if i < len(frases(texto)) - 1:
            partes.append(np.zeros(int(PAUSA_FRASE * sr), np.float32))
    sf.write(wav_out, np.concatenate(partes), sr)


def aparar(a, sr, lim=0.006, margem=0.04):
    idx = np.where(np.abs(a) > lim)[0]
    if not len(idx):
        return a
    i0 = max(0, idx[0] - int(margem * sr)); i1 = min(len(a), idx[-1] + int(margem * sr * 2))
    return a[i0:i1]


def tts_edge(texto, wav_out):
    o = CFG['VOZ_OPCOES']['edge']
    mp3 = wav_out.replace('.raw.wav', '.edge.mp3')
    cmd = ['edge-tts', '--voice', o['voz'], f"--rate={o['rate']}", '--text', texto, '--write-media', mp3,
           '--write-subtitles', mp3.replace('.mp3', '.srt')]
    if os.environ.get('HTTPS_PROXY'):
        cmd += ['--proxy', os.environ['HTTPS_PROXY']]
    run(cmd)
    run(['ffmpeg', '-y', '-v', 'error', '-i', mp3, wav_out])


def tts_elevenlabs(texto, wav_out):
    o = CFG['VOZ_OPCOES']['elevenlabs']
    key = os.environ.get(o['key_env']); voice = os.environ.get(o['voice_id_env'])
    if not key or not voice:
        sys.exit('Defina ELEVENLABS_KEY e ELEVENLABS_VOICE no ambiente.')
    body = json.dumps({'text': texto, 'model_id': o['model'], 'voice_settings': {
        'stability': 0.45, 'similarity_boost': 0.8, 'style': 0.15, 'use_speaker_boost': True}}).encode()
    req = urllib.request.Request(f'https://api.elevenlabs.io/v1/text-to-speech/{voice}/with-timestamps',
                                 data=body, headers={'xi-api-key': key, 'Content-Type': 'application/json'})
    d = json.load(urllib.request.urlopen(req))
    mp3 = wav_out.replace('.raw.wav', '.el.mp3')
    open(mp3, 'wb').write(base64.b64decode(d['audio_base64']))
    json.dump(d.get('alignment'), open(mp3 + '.alignment.json', 'w'))
    run(['ffmpeg', '-y', '-v', 'error', '-i', mp3, wav_out])


MOTORES = {'kokoro': tts_kokoro, 'edge': tts_edge, 'elevenlabs': tts_elevenlabs}


# ---------------- loudnorm em duas passadas ----------------
def loudnorm(src, dst, I=-16, TP=-1.5, LRA=11):
    flt = f'loudnorm=I={I}:TP={TP}:LRA={LRA}'
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', src, '-af', flt + ':print_format=json', '-f', 'null', '-'],
                       capture_output=True, text=True)
    m = json.loads(r.stderr[r.stderr.rindex('{'):r.stderr.rindex('}') + 1])
    flt2 = (f"{flt}:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
            f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
    run(['ffmpeg', '-y', '-v', 'error', '-i', src, '-af', flt2 + f',aresample={SR}', '-ar', str(SR), '-ac', '1',
         '-c:a', 'pcm_s16le', dst])


def duracao(f):
    return float(run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).stdout.strip())


# ---------------- transcrição (opcional) ----------------
_wh = None
def transcrever(wav, palavras=True):
    global _wh
    from faster_whisper import WhisperModel
    if _wh is None:
        _wh = WhisperModel(os.path.join(MODELS, 'whisper-small'), device='cpu', compute_type='int8')
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', wav, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'],
                         capture_output=True).stdout
    segs, _ = _wh.transcribe(np.frombuffer(raw, np.float32), language='pt', beam_size=5, word_timestamps=palavras)
    segs = list(segs)
    txt = ' '.join(s.text.strip() for s in segs)
    ws = [{'w': w.word.strip(), 's': round(w.start, 3), 'e': round(w.end, 3)} for s in segs for w in (s.words or [])]
    return txt, ws


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--cenas', default='')
    ap.add_argument('--transcrever', action='store_true')
    a = ap.parse_args()
    os.makedirs(AUD, exist_ok=True)
    alvo = set(filter(None, a.cenas.split(','))) or {c['id'] for c in ROT}
    motor = MOTORES[CFG['VOZ']]
    durs_f = os.path.join(AUD, 'duracoes.json')
    durs = json.load(open(durs_f)) if os.path.exists(durs_f) else {}
    for c in ROT:
        if c['id'] not in alvo:
            continue
        raw = os.path.join(AUD, f"{c['id']}.raw.wav")
        out = os.path.join(AUD, f"{c['id']}.wav")
        motor(c['fala'], raw)
        loudnorm(raw, out)
        os.remove(raw)
        d = duracao(out)
        durs[c['id']] = round(d, 3)
        info = {'id': c['id'], 'duracao': d}
        if a.transcrever:
            txt, ws = transcrever(out)
            json.dump({'texto': txt, 'palavras': ws}, open(os.path.join(AUD, f"{c['id']}.palavras.json"), 'w'),
                      ensure_ascii=False, indent=1)
            info['transcricao'] = txt
        print(json.dumps(info, ensure_ascii=False), flush=True)
    json.dump(dict(sorted(durs.items())), open(durs_f, 'w'), indent=2)


if __name__ == '__main__':
    main()
