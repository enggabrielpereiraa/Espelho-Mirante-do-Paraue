#!/usr/bin/env python3
"""Monta as legendas (no máximo 2 linhas de até 42 caracteres) a partir dos tempos alinhados.
Saída: build/legendas.json (blocos com linhas e tempos absolutos) e out/legendas.srt
Uso: python3 scripts/legendas.py build/timeline.json
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROT = json.load(open(os.path.join(ROOT, 'roteiro.json'), encoding='utf8'))
MAX = 42
# não terminar linha/bloco em palavra curta de ligação
LIG = {'a', 'o', 'as', 'os', 'de', 'da', 'do', 'das', 'dos', 'que', 'e', 'em', 'no', 'na', 'num', 'numa', 'um', 'uma', 'pra', 'com', 'por', 'ou', 'é'}


def quebrar(palavras):
    """Quebra em 1 ou 2 linhas equilibradas, cada uma com até MAX caracteres. None se não couber."""
    txt = ' '.join(palavras)
    if len(txt) <= MAX:
        return [txt]
    best = None
    for i in range(1, len(palavras)):
        a, b = ' '.join(palavras[:i]), ' '.join(palavras[i:])
        if len(a) <= MAX and len(b) <= MAX:
            # prefere linhas parecidas e quebra depois de vírgula
            custo = abs(len(a) - len(b)) - (8 if palavras[i - 1].endswith(',') else 0) + (14 if palavras[i - 1].lower() in LIG else 0)
            if best is None or custo < best[0]:
                best = (custo, [a, b])
    return best[1] if best else None


def blocos(ws):
    """Divide a lista de palavras (com tempos) em blocos que caibam em 2 linhas."""
    frases, cur = [], []
    for w in ws:
        cur.append(w)
        if re.search(r'[.!?]$', w['w']):
            frases.append(cur); cur = []
    if cur:
        frases.append(cur)
    out = []

    def dividir(seg):
        txt = [w['w'] for w in seg]
        if quebrar(txt) and len(' '.join(txt)) <= 70:
            out.append(seg); return
        # corta no ponto mais equilibrado, de preferência depois de vírgula
        n = len(seg); best = None
        for i in range(2, n - 1):
            a, b = ' '.join(txt[:i]), ' '.join(txt[i:])
            custo = abs(len(a) - len(b)) - (25 if txt[i - 1].endswith(',') else 0) - (6 if txt[i] in ('e', 'ou', 'que', 'com') else 0) + (30 if txt[i - 1].lower() in LIG else 0)
            if best is None or custo < best[0]:
                best = (custo, i)
        i = best[1]
        dividir(seg[:i]); dividir(seg[i:])

    for f in frases:
        dividir(f)
    return out


def srt_t(t):
    ms = int(round(t * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f'{h:02}:{m:02}:{s:02},{ms:03}'


def main():
    tl = json.load(open(sys.argv[1]))
    cues = []
    for c in ROT:
        sc = next(x for x in tl['cenas'] if x['id'] == c['id'])
        tp = json.load(open(os.path.join(ROOT, 'audio', f"{c['id']}.tempos.json"), encoding='utf8'))
        base = sc['start'] + sc['lead']
        bs = blocos(tp['legenda'])
        for k, b in enumerate(bs):
            ini = base + b[0]['s'] - 0.08
            fim = base + b[-1]['e'] + 0.35
            if k + 1 < len(bs):
                fim = min(fim, base + bs[k + 1][0]['s'] - 0.1)
            else:
                fim = min(fim, sc['start'] + sc['dur'] - 0.15)
            cues.append({'cena': c['id'], 'ini': round(ini, 3), 'fim': round(max(fim, ini + 1.0), 3),
                         'linhas': quebrar([w['w'] for w in b])})
    os.makedirs(os.path.join(ROOT, 'build'), exist_ok=True)
    json.dump(cues, open(os.path.join(ROOT, 'build', 'legendas.json'), 'w'), ensure_ascii=False, indent=1)
    os.makedirs(os.path.join(ROOT, 'out'), exist_ok=True)
    with open(os.path.join(ROOT, 'out', 'legendas.srt'), 'w', encoding='utf8') as f:
        for i, q in enumerate(cues, 1):
            f.write(f"{i}\n{srt_t(q['ini'])} --> {srt_t(q['fim'])}\n" + '\n'.join(q['linhas']) + '\n\n')
    print(f'{len(cues)} legendas')


if __name__ == '__main__':
    main()
