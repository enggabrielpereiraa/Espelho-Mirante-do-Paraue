#!/usr/bin/env python3
"""Montagem final: zoom lento nas cenas marcadas, cortes secos / fade cruzado, cards, legendas, voz e música.
Uso: python3 scripts/montar.py [--vertical]
"""
import json, os, subprocess, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CFG = json.load(open(os.path.join(ROOT, 'config.json'), encoding='utf8'))
VERT = '--vertical' in sys.argv
SUF = 'v' if VERT else 'h'
B = os.path.join(ROOT, 'build', SUF)
W, H = (1080, 1920) if VERT else (1920, 1080)
FPS = 30
OUT = os.path.join(ROOT, 'out', 'apresentacao-vertical.mp4' if VERT else 'apresentacao-1080p.mp4')
ZMAX, ZIN, ZOUT = 1.08, 2.5, 1.2
LT_IN, LT_OUT, LT_FADE = 0.4, 0.6, 0.25
LEG_FADE = 0.12
ABERTURA = (0.0, 3.0, 0.6)            # início, fim, duração do fade
FINAL_EM = 3.0                         # o card final entra aos 3 s da C12
FADE_FIM = 0.8


def sh(cmd, **kw):
    r = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if r.returncode:
        sys.stderr.write(r.stderr[-4000:]); raise SystemExit(f'falhou: {cmd[:6]}')
    return r


def ease(x):
    x = min(1.0, max(0.0, x))
    return 4 * x ** 3 if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2


def zoom_clip(src, dst, zooms, dur):
    """Zoom 1.00 -> 1.08 em 2,5 s (subpixel, sem tremer), segura e volta. Centro: painel da direita ou centro."""
    import cv2
    def z_at(t):
        z = 1.0
        for zm in zooms:
            if t < zm['in']:
                continue
            zi = 1 + (ZMAX - 1) * ease((t - zm['in']) / ZIN)
            if zm['out'] < dur - 0.05 and t >= zm['out']:
                zi = 1 + (zi - 1) * (1 - ease((t - zm['out']) / ZOUT))
            z = max(z, zi)
        return z
    foco = zooms[0]['foco']
    cx, cy = ((W - 186) if foco == 'painel' else W / 2), H / 2
    dec = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', src, '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-'], stdout=subprocess.PIPE)
    enc = subprocess.Popen(['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                            '-c:v', 'libx264', '-crf', '12', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', dst], stdin=subprocess.PIPE)
    n = 0; fb = W * H * 3
    while True:
        buf = dec.stdout.read(fb)
        if len(buf) < fb:
            break
        img = np.frombuffer(buf, np.uint8).reshape(H, W, 3)
        z = z_at(n / FPS)
        if z > 1.0005:
            # mantém o foco na tela sem mostrar borda
            fx = min(max(cx, W / (2 * z)), W - W / (2 * z)); fy = min(max(cy, H / (2 * z)), H - H / (2 * z))
            M = np.array([[z, 0, W / 2 - z * fx], [0, z, H / 2 - z * fy]], np.float32)
            img = cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
        enc.stdin.write(img.tobytes()); n += 1
    enc.stdin.close(); enc.wait(); dec.wait()


def loudnorm_args(src, I, TP=-1.5, LRA=11, extra_in=None):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', src, '-af', f'loudnorm=I={I}:TP={TP}:LRA={LRA}:print_format=json', '-f', 'null', '-'],
                       capture_output=True, text=True)
    m = json.loads(r.stderr[r.stderr.rindex('{'):r.stderr.rindex('}') + 1])
    return (f"loudnorm=I={I}:TP={TP}:LRA={LRA}:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
            f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")


def main():
    tl = json.load(open(os.path.join(ROOT, 'build', 'timeline.json')))
    rec = json.load(open(os.path.join(B, 'gravacao.json')))
    cards = json.load(open(os.path.join(B, 'cards', 'index.json')))
    total = tl['total']
    cenas = tl['cenas']

    # 1) zoom nas cenas marcadas
    clips = []
    for c in cenas:
        src = os.path.join(B, f"{c['id']}.mp4")
        zs = rec.get(c['id'], {}).get('zooms') or []
        if zs and not VERT:
            dst = os.path.join(B, f"{c['id']}.zoom.mp4")
            print('zoom', c['id']); zoom_clip(src, dst, zs, c['dur'])
            src = dst
        clips.append(src)

    # 2) vídeo: cortes secos e fade cruzado de 300 ms quando muda a rota
    inputs, fc = [], []
    for k, f in enumerate(clips):
        inputs += ['-i', f]
        fc.append(f"[{k}:v]setpts=PTS-STARTPTS,fps={FPS},settb=1/{FPS},format=yuv420p[c{k}]")
    cur = 'c0'
    acc = cenas[0]['dur']
    for k in range(1, len(cenas)):
        c = cenas[k]
        if c['xfade']:
            fc.append(f"[{cur}][c{k}]xfade=transition=fade:duration={tl['XFADE']}:offset={c['start']:.3f},settb=1/{FPS}[x{k}]")
        else:
            fc.append(f"[{cur}][c{k}]concat=n=2:v=1:a=0,settb=1/{FPS}[x{k}]")
        cur = f'x{k}'
    n = len(clips)

    # 3) cards e legendas por cima (cada PNG só existe na sua janela de tempo)
    def overlay(png, ini, fim, fade, x='0', y='0'):
        nonlocal cur, n
        d = fim - ini
        inputs.extend(['-loop', '1', '-framerate', str(FPS), '-t', f'{d:.3f}', '-i', png])
        fc.append(f"[{n}:v]format=rgba,fade=in:st=0:d={fade}:alpha=1,fade=out:st={max(0, d - fade):.3f}:d={fade}:alpha=1,setpts=PTS+{ini:.3f}/TB[o{n}]")
        fc.append(f"[{cur}][o{n}]overlay=x={x}:y={y}:eof_action=pass:format=auto[v{n}]")
        cur = f'v{n}'; n += 1

    a0, a1, af = ABERTURA
    overlay(os.path.join(B, 'cards', 'abertura.png'), a0 + 0.2, a1, af)
    for c in cenas:
        lt = cards['lt'].get(c['id'])
        if not lt:
            continue
        ini = c['start'] + (a1 + 0.2 if c['id'] == 'C01' else LT_IN)
        fim = c['start'] + c['dur'] - LT_OUT
        overlay(lt['png'], ini, fim, LT_FADE, lt['x'], lt['y'])
    # o card final (que escurece a imagem) vem antes das legendas, para não escurecê-las
    c12 = cenas[-1]
    overlay(os.path.join(B, 'cards', 'final.png'), c12['start'] + FINAL_EM, total + 0.5, 0.6)
    for q in cards['legendas']:
        overlay(q['png'], q['ini'], q['fim'], LEG_FADE, q['x'], q['y'])
    fc.append(f"[{cur}]fade=out:st={total - FADE_FIM:.3f}:d={FADE_FIM},trim=duration={total:.3f},format=yuv420p[vout]")

    # 4) áudio: cada cena no seu lugar, 48 kHz
    voz = os.path.join(B, 'voz.wav')
    ain, afc = [], []
    for k, c in enumerate(cenas):
        ain += ['-i', os.path.join(ROOT, 'audio', f"{c['id']}.wav")]
        ms = int(round((c['start'] + c['lead']) * 1000))
        afc.append(f"[{k}:a]aresample=48000,adelay={ms}|{ms}[a{k}]")
    afc.append(''.join(f'[a{k}]' for k in range(len(cenas))) + f"amix=inputs={len(cenas)}:normalize=0:dropout_transition=0,apad,atrim=duration={total:.3f}[voz]")
    sh(['ffmpeg', '-y', '-v', 'error', *ain, '-filter_complex', ';'.join(afc), '-map', '[voz]', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', voz])

    mix = os.path.join(B, 'mix.wav')
    musica = os.path.join(ROOT, CFG.get('MUSICA') or '')
    if CFG.get('MUSICA') and os.path.isfile(musica):
        mus = os.path.join(B, 'musica.wav')
        sh(['ffmpeg', '-y', '-v', 'error', '-stream_loop', '-1', '-i', musica, '-t', f'{total:.3f}', '-ar', '48000', '-ac', '2', mus + '.tmp.wav'])
        ln = loudnorm_args(mus + '.tmp.wav', -28)
        sh(['ffmpeg', '-y', '-v', 'error', '-i', mus + '.tmp.wav', '-af', f"{ln},afade=in:st=0:d=2,afade=out:st={total - 3:.3f}:d=3", '-ar', '48000', mus])
        sh(['ffmpeg', '-y', '-v', 'error', '-i', voz, '-i', mus, '-filter_complex',
            '[0:a]asplit=2[v1][v2];[1:a][v2]sidechaincompress=threshold=0.02:ratio=8:attack=20:release=400[duck];'
            '[v1][duck]amix=inputs=2:normalize=0:duration=first[m]', '-map', '[m]', '-ar', '48000', mix])
        print('música: sim')
    else:
        sh(['ffmpeg', '-y', '-v', 'error', '-i', voz, '-c', 'copy', mix])
        print('música: não (assets/musica.mp3 não existe), só voz')
    final_a = os.path.join(B, 'mix_norm.wav')
    ln = loudnorm_args(mix, -16)
    sh(['ffmpeg', '-y', '-v', 'error', '-i', mix, '-af', f"{ln},afade=out:st={total - FADE_FIM:.3f}:d={FADE_FIM}", '-ar', '48000', final_a])

    # 5) exporta
    inputs += ['-i', final_a]
    fg = os.path.join(B, 'filtro.txt')
    open(fg, 'w').write(';\n'.join(fc))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    print('exportando', OUT)
    sh(['ffmpeg', '-y', '-v', 'error', *inputs, '-filter_complex_script', fg, '-map', '[vout]', '-map', f'{n}:a',
        '-c:v', 'libx264', '-crf', '18', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-r', str(FPS),
        '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', '-t', f'{total:.3f}', OUT])
    d = float(sh(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', OUT]).stdout)
    print(f'ok: {OUT} ({d:.2f} s)')


if __name__ == '__main__':
    main()
