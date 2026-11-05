#!/usr/bin/env bash
# Baixa (via npm, que funciona mesmo em redes restritas) os modelos usados offline:
#  - Kokoro-82M q8 (voz)            -> models/kokoro/kokoro-q8.onnx
#  - vozes pt-BR do Kokoro           -> models/kokoro/voices-pt.npz (pm_alex, pm_santa, pf_dora)
#  - Whisper small CTranslate2 int8  -> models/whisper-small/ (conferência de pronúncia e sincronia)
set -euo pipefail
cd "$(dirname "$0")/.."
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
mkdir -p models/kokoro
if [ ! -f models/kokoro/kokoro-q8.onnx ]; then
  (cd "$TMP" && npm pack kokoro-q8-shards@1.0.0 --silent >/dev/null && tar xzf kokoro-q8-shards-1.0.0.tgz)
  cat "$TMP"/package/kokoro-q8.part{0,1,2,3,4,5}.bin > models/kokoro/kokoro-q8.onnx
  echo "fbae9257e1e05ffc727e951ef9b9c98418e6d79f1c9b6b13bd59f5c9028a1478  models/kokoro/kokoro-q8.onnx" | sha256sum -c -
  rm -rf "$TMP"/package
fi
if [ ! -f models/kokoro/voices-pt.npz ]; then
  (cd "$TMP" && npm pack expo-kokoro@1.1.9 --silent >/dev/null && tar xzf expo-kokoro-1.1.9.tgz package/build/voices/pm_alex.bin package/build/voices/pm_santa.bin package/build/voices/pf_dora.bin)
  python3 -c "
import numpy as np,sys
d='$TMP/package/build/voices/'
np.savez('models/kokoro/voices-pt.npz',**{n:np.fromfile(d+n+'.bin',dtype=np.float32).reshape(510,1,256) for n in ['pm_alex','pm_santa','pf_dora']})"
  rm -rf "$TMP"/package
fi
if [ ! -f models/whisper-small/model.bin ]; then
  mkdir -p "$TMP/wh"
  for i in 0 1 2 3; do (cd "$TMP" && npm pack @skillninja/shortmovie-telop-model-p$i@1.0.0 --silent >/dev/null && tar xzf skillninja-shortmovie-telop-model-p$i-1.0.0.tgz -C wh); done
  cat "$TMP"/wh/package/model.bin.part{0,1,2,3} > "$TMP/wh/package/model.bin"; rm "$TMP"/wh/package/model.bin.part*
  (cd "$TMP/wh/package" && echo "$(cat model.sha256 | cut -d' ' -f1)  model.bin" | sha256sum -c -)
  mkdir -p models && mv "$TMP/wh/package" models/whisper-small
fi
echo "modelos ok"
