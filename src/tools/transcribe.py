"""Draft the transcript of a recorded narration, for `pnpm align`.

    python3 src/tools/transcribe.py <audio> [--model large-v3-turbo] [--lang zh] [--at 3] > stories/<id>/narration.json

Needs faster-whisper (pip install faster-whisper; the model downloads from
Hugging Face on first use, ~1.6 GB for large-v3-turbo). Prints narration.json
with one line per sentence. Proofread it before aligning: words recognised
with low confidence are listed on stderr with their times. Run a second model
(--model large-v3) over the doubtful spots as a cross-check; a homophone that
breaks the meaning (e.g. 蓝紧的 for 了安静的) is the usual failure.
"""
import argparse
import json
import re
import subprocess
import sys

import numpy as np
from faster_whisper import WhisperModel

PROMPTS = {"zh": "以下是普通话的句子，使用简体中文，带标点符号。"}

ap = argparse.ArgumentParser()
ap.add_argument("audio")
ap.add_argument("--model", default="large-v3-turbo")
ap.add_argument("--lang", default="zh")
ap.add_argument("--at", type=float, default=0.0, help="film time where the recording starts")
ap.add_argument("--flag", type=float, default=0.7, help="list words below this probability")
a = ap.parse_args()

# Decode with ffmpeg (16 kHz mono float) rather than through PyAV.
pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", a.audio, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"],
                     capture_output=True, check=True).stdout
audio = np.frombuffer(pcm, dtype=np.float32).copy()
model = WhisperModel(a.model, device="cpu", compute_type="int8")
segments, _ = model.transcribe(audio, language=a.lang, beam_size=5, word_timestamps=True,
                               initial_prompt=PROMPTS.get(a.lang))

text, doubtful = "", []
for s in segments:
    text += s.text.strip()
    doubtful += [(w.start, w.word, w.probability) for w in (s.words or []) if w.probability < a.flag]
if a.lang in ("zh", "ja"):
    text = text.replace(",", "，").replace("?", "？").replace("!", "！")
sentences = [x for x in re.split(r"(?<=[。！？.!?])", text) if x.strip()]
json.dump({"at": a.at, "lines": [{"speaker": "narrator", "text": x.strip()} for x in sentences]},
          sys.stdout, ensure_ascii=False, indent=1)
print()
for t, w, p in doubtful:
    print(f"check {t + a.at:7.2f}s  {w}  (p={p:.2f})", file=sys.stderr)
