#!/usr/bin/env python3
"""Alinha as palavras do roteiro (fala e legenda) com os tempos da transcrição de cada áudio.
Saída: audio/Cxx.tempos.json  {"fala": [{w,s,e}], "legenda": [{w,s,e}]}
Os tempos são em segundos a partir do início do áudio da cena.
"""
import json, os, re, unicodedata, difflib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROT = json.load(open(os.path.join(ROOT, 'roteiro.json'), encoding='utf8'))
AUD = os.path.join(ROOT, 'audio')
EQUIV = {'pra': 'para', 'tres': '3', 'de3': '3d'}


def norm(w):
    w = unicodedata.normalize('NFD', w.lower())
    w = ''.join(ch for ch in w if unicodedata.category(ch) != 'Mn')
    w = re.sub(r'[^a-z0-9]', '', w)
    return EQUIV.get(w, w)


def alinhar(palavras_txt, ws):
    a = [norm(w) for w in palavras_txt]
    b = [norm(w['w']) for w in ws]
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    t = [None] * len(a)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == 'equal':
            for k in range(i2 - i1):
                t[i1 + k] = (ws[j1 + k]['s'], ws[j1 + k]['e'])
        elif tag == 'replace':
            # distribui proporcionalmente o trecho transcrito pelas palavras do roteiro
            s0, e0 = ws[j1]['s'], ws[j2 - 1]['e']
            n = i2 - i1
            for k in range(n):
                t[i1 + k] = (s0 + (e0 - s0) * k / n, s0 + (e0 - s0) * (k + 1) / n)
    # interpola o que ficou sem tempo (palavras que a transcrição pulou)
    for i in range(len(t)):
        if t[i] is None:
            prev = next((t[j][1] for j in range(i - 1, -1, -1) if t[j]), 0.0)
            nxt = next((t[j][0] for j in range(i + 1, len(t)) if t[j]), prev + 0.3)
            t[i] = (prev, max(prev + 0.05, nxt))
    return [{'w': w, 's': round(s, 3), 'e': round(e, 3)} for w, (s, e) in zip(palavras_txt, t)]


def main():
    for c in ROT:
        f = os.path.join(AUD, f"{c['id']}.palavras.json")
        if not os.path.exists(f):
            continue
        ws = json.load(open(f, encoding='utf8'))['palavras']
        out = {'fala': alinhar(c['fala'].split(), ws), 'legenda': alinhar(c['legenda'].split(), ws)}
        json.dump(out, open(os.path.join(AUD, f"{c['id']}.tempos.json"), 'w'), ensure_ascii=False, indent=1)
    print('alinhamento ok')


if __name__ == '__main__':
    main()
