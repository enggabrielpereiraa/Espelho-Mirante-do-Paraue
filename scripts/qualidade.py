#!/usr/bin/env python3
"""Verificações da seção 8. Uso: python3 scripts/qualidade.py [--vertical] [--sem-transcricao]
Gera revisao/<h|v>/quadros/*.jpg, revisao/sincronia.md (ou sincronia-vertical.md) e revisao/qualidade-<h|v>.json
"""
import json, os, re, subprocess, sys, difflib, unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VERT = '--vertical' in sys.argv
SUF = 'v' if VERT else 'h'
VID = os.path.join(ROOT, 'out', 'apresentacao-vertical.mp4' if VERT else 'apresentacao-1080p.mp4')
REV = os.path.join(ROOT, 'revisao')
ROT = json.load(open(os.path.join(ROOT, 'roteiro.json'), encoding='utf8'))


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def norm(w):
    w = unicodedata.normalize('NFD', w.lower())
    return re.sub(r'[^a-z0-9]', '', ''.join(c for c in w if unicodedata.category(c) != 'Mn'))


def main():
    res = {}
    dur = float(run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', VID]).stdout)
    res['duracao'] = round(dur, 2)
    res['duracao_ok'] = 150 <= dur <= 195

    # loudness (ebur128 com true peak)
    r = run(['ffmpeg', '-hide_banner', '-nostats', '-i', VID, '-af', 'ebur128=peak=true', '-f', 'null', '-'])
    s = r.stderr[r.stderr.rindex('Summary:'):]
    I = float(re.search(r'I:\s+(-?[\d.]+) LUFS', s).group(1))
    tp = float(re.search(r'Peak:\s+(-?[\d.]+) dBFS', s).group(1))
    res['loudness_LUFS'] = I; res['true_peak_dBTP'] = tp; res['loudness_ok'] = abs(I + 16) <= 1 and tp <= -1.0

    # blackdetect / freezedetect
    r = run(['ffmpeg', '-hide_banner', '-nostats', '-i', VID, '-vf', 'blackdetect=d=0.3:pix_th=0.10,freezedetect=n=-80dB:d=2.5', '-an', '-f', 'null', '-'])
    pretos = [(float(a), float(b), float(c)) for a, b, c in re.findall(r'black_start:([\d.]+) black_end:([\d.]+) black_duration:([\d.]+)', r.stderr)]
    fs_ = re.findall(r'freeze_start: ([\d.]+)', r.stderr); fd = re.findall(r'freeze_duration: ([\d.]+)', r.stderr)
    congel = [(float(a), float(b)) for a, b in zip(fs_, fd)]
    res['blackdetect'] = pretos; res['freezedetect'] = congel

    # quadros de revisão: 1 a cada 3 s
    qd = os.path.join(REV, SUF, 'quadros'); os.makedirs(qd, exist_ok=True)
    for f in os.listdir(qd):
        os.remove(os.path.join(qd, f))
    run(['ffmpeg', '-v', 'error', '-i', VID, '-vf', 'fps=1/3', '-q:v', '3', os.path.join(qd, 'q_%03d.jpg')])
    res['quadros_revisao'] = len(os.listdir(qd))

    # sincronia: ação x palavra-chave da fala
    tl = json.load(open(os.path.join(ROOT, 'build', 'timeline.json')))
    rec = json.load(open(os.path.join(ROOT, 'build', SUF, 'gravacao.json')))
    linhas = ['# Sincronia ação × fala' + (' (vertical)' if VERT else ''), '',
              'Tempo absoluto no vídeo final. "Palavra" = palavra da narração mais próxima do instante planejado para a ação.',
              'Critério: |Δ| ≤ 0,5 s entre a ação e o início da palavra que a descreve.', '',
              '| Cena | Ação | Ação (s) | Palavra | Palavra (s) | Δ (s) | OK |', '|---|---|---:|---|---:|---:|:--:|']
    piores = []
    for c in tl['cenas']:
        tp_ = json.load(open(os.path.join(ROOT, 'audio', f"{c['id']}.tempos.json"), encoding='utf8'))['fala']
        for m in rec.get(c['id'], {}).get('marks', []):
            if 'alvo' not in m:
                continue
            if m.get('livre'):
                linhas.append(f"| {c['id']} | {m['label']} | {c['start'] + m['t']:.2f} | (não descrita na fala) | | | — |")
                continue
            ta = c['start'] + m['t']
            alvo_rel = m['alvo'] - c['lead']
            # palavra cujo início está mais perto do alvo
            w = min(tp_, key=lambda x: abs(x['s'] - alvo_rel))
            tw = c['start'] + c['lead'] + w['s']
            d = ta - tw
            ok = abs(d) <= 0.5
            if not ok:
                piores.append((c['id'], m['label'], round(d, 2)))
            linhas.append(f"| {c['id']} | {m['label']} | {ta:.2f} | {w['w'].strip(',.')} | {tw:.2f} | {d:+.2f} | {'✓' if ok else '✗'} |")
    linhas += ['', f'Ações fora da janela de ±0,5 s: {len(piores)}'] + [f'- {a} · {b}: {d:+.2f} s' for a, b, d in piores]
    open(os.path.join(REV, 'sincronia-vertical.md' if VERT else 'sincronia.md'), 'w').write('\n'.join(linhas) + '\n')
    res['sincronia_fora'] = piores

    # transcrição da narração final x roteiro (legenda)
    if '--sem-transcricao' not in sys.argv:
        sys.path.insert(0, os.path.join(ROOT, 'scripts'))
        import voz
        wav = os.path.join(ROOT, 'build', SUF, 'final_audio_16k.wav')
        run(['ffmpeg', '-y', '-v', 'error', '-i', VID, '-ac', '1', '-ar', '16000', wav])
        txt, _ = voz.transcrever(wav, palavras=False)
        ref = ' '.join(c['legenda'] for c in ROT).split()
        hyp = txt.split()
        a = [norm(x) for x in ref]; b = [norm(x) for x in hyp]
        eq = {'para': 'pra'}
        a = [eq.get(x, x) for x in a]; b = [eq.get(x, x) for x in b]
        dif = []
        for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
            if tag != 'equal':
                dif.append({'roteiro': ' '.join(ref[i1:i2]), 'ouvido': ' '.join(hyp[j1:j2])})
        res['transcricao_diferencas'] = dif
        open(os.path.join(REV, f'transcricao-{SUF}.txt'), 'w').write(txt + '\n')
    json.dump(res, open(os.path.join(REV, f'qualidade-{SUF}.json'), 'w'), ensure_ascii=False, indent=1)
    print(json.dumps({k: v for k, v in res.items() if k != 'transcricao_diferencas'}, ensure_ascii=False, indent=1))
    if 'transcricao_diferencas' in res:
        print('diferenças na transcrição:', len(res['transcricao_diferencas']))
        for d in res['transcricao_diferencas']:
            print(f"  roteiro: {d['roteiro']!r:40} ouvido: {d['ouvido']!r}")


if __name__ == '__main__':
    main()
