#!/usr/bin/env python3
"""Story do Instagram (1080x1920, 30 fps): trechos das cenas já gravadas dentro de uma janela
de navegador, um título por função e card final com os contatos. Sem narração.
Uso: node scripts/story.js && python3 scripts/story.py
Saída: out/story-instagram.mp4
"""
import json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = json.load(open(os.path.join(ROOT, 'scripts', 'story-config.json'), encoding='utf8'))
B = os.path.join(ROOT, 'build', 'story')
SRC = os.path.join(ROOT, 'build', 'h')
OUT = os.path.join(ROOT, 'out', 'story-instagram.mp4')
FPS, XF = 30, S['transicao']
L = S['layout']
SW = L['win']['w']; SH = round(SW * 10 / 16)
WX, WY = L['win']['x'], L['win']['y'] + L['barra']


def sh(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        sys.stderr.write(r.stderr[-3000:]); raise SystemExit('ffmpeg falhou')
    return r


def main():
    segs = S['segmentos'] + [dict(S['final'], corte=[96, 0, 1728], final=True)]
    # 1) trechos: corte 16:10 da tela gravada, escala para a janela
    inputs, fc = [], []
    for k, s in enumerate(segs):
        src = os.path.join(SRC, f"{s['cena']}.mp4")
        x, y, w = s['corte']; h = round(w * 10 / 16)
        d = s['dur'] + (XF if k < len(segs) - 1 else 0)
        inputs += ['-ss', f"{s['inicio']:.3f}", '-t', f'{d:.3f}', '-i', src]
        fc.append(f"[{k}:v]crop={w}:{h}:{x}:{y},scale={SW}:{SH}:flags=lanczos,fps={FPS},setpts=PTS-STARTPTS,settb=1/{FPS},format=yuv420p[s{k}]")
    cur, t = 's0', segs[0]['dur']
    inicios = [0.0]
    for k in range(1, len(segs)):
        fc.append(f"[{cur}][s{k}]xfade=transition=fade:duration={XF}:offset={t:.3f},settb=1/{FPS}[x{k}]")
        inicios.append(t); cur = f'x{k}'; t += segs[k]['dur']
    total = t
    n = len(segs)

    def img(path, d=None):
        nonlocal n
        inputs.extend(['-loop', '1', '-framerate', str(FPS), '-t', f'{d or total:.3f}', '-i', path]); n += 1
        return n - 1

    # 2) tela com cantos arredondados embaixo
    m = img(os.path.join(B, 'mascara.png'))
    fc.append(f"[{m}:v]format=gray,scale={SW}:{SH}[mk];[{cur}]format=yuva420p[sv];[sv][mk]alphamerge[tela]")
    f = img(os.path.join(B, 'fundo.png'))
    mo = img(os.path.join(B, 'moldura.png'))
    fc.append(f"[{f}:v]format=yuva420p[bg];[bg][{mo}:v]overlay=0:0[b1];[b1][tela]overlay={WX}:{WY}:shortest=1[v0]")
    cur = 'v0'
    # 3) títulos (entram subindo 24 px com fade) e barra de progresso
    for k, s in enumerate(S['segmentos']):
        ini = inicios[k]; d = s['dur'] + (XF if k else 0) * 0
        fim = inicios[k + 1] + XF
        for nome, sobe in ((f'titulo_{k}.png', True), (f'prog_{k}.png', False)):
            i = img(os.path.join(B, nome), fim - ini)
            dd = fim - ini
            fc.append(f"[{i}:v]format=rgba,fade=in:st=0:d=0.3:alpha=1,fade=out:st={dd - 0.25:.3f}:d=0.25:alpha=1,setpts=PTS+{ini:.3f}/TB[o{i}]")
            y = f"'24*max(0,1-(t-{ini:.3f})/0.35)'" if sobe else '0'
            fc.append(f"[{cur}][o{i}]overlay=x=0:y={y}:eval=frame:eof_action=pass[w{i}]")
            cur = f'w{i}'
    # 4) card final
    ini = inicios[-1] + 0.15
    i = img(os.path.join(B, 'final.png'), total - ini)
    fc.append(f"[{i}:v]format=rgba,fade=in:st=0:d=0.45:alpha=1,setpts=PTS+{ini:.3f}/TB[o{i}]")
    fc.append(f"[{cur}][o{i}]overlay=0:0:eof_action=pass,fade=in:st=0:d=0.3,trim=duration={total:.3f},format=yuv420p[vout]")
    # áudio silencioso (o Instagram aceita melhor arquivos com faixa de áudio)
    inputs += ['-f', 'lavfi', '-t', f'{total:.3f}', '-i', 'anullsrc=r=48000:cl=stereo']
    fg = os.path.join(B, 'filtro.txt'); open(fg, 'w').write(';\n'.join(fc))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    sh(['ffmpeg', '-y', '-v', 'error', *inputs, '-filter_complex_script', fg, '-map', '[vout]', '-map', f'{n}:a',
        '-c:v', 'libx264', '-crf', '18', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-r', str(FPS), '-profile:v', 'high',
        '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-t', f'{total:.3f}', OUT])
    d = float(sh(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', OUT]).stdout)
    print(f'ok: {OUT} ({d:.2f} s)')


if __name__ == '__main__':
    main()
