#!/usr/bin/env python3
"""
RUMBO · Teaser — pista instrumental
Sintetiza la música descrita en el brief: piano y pads suaves al
amanecer, un beat discreto en el montaje del día, respiro en el
cierre nocturno y un acorde limpio sobre el logo.

Sin librerías de audio ni samples: todo se genera aquí.
    python3 teaser/music.py [--out teaser/out/rumbo-teaser-music.wav]
"""
import argparse
import struct
import wave
from pathlib import Path

import numpy as np

SR = 44100
BPM = 84.0
SPB = 60.0 / BPM          # 0.714 s por pulso
BAR = SPB * 4             # 2.857 s por compás

# Cada compás cumple un papel; el montaje sigue al guion del teaser.
#   amanecer · sólo colchón y una nota suelta
#   piano    · entra el motivo y el bajo
#   dia      · se suma la percusión
#   salida   · la percusión se retira
#   noche    · vuelve el aire: ni bajo ni batería
#   subida   · regresa el cuerpo, sin percusión
#   final    · acorde de resolución, dejado sonar
CORTES = {
    "completo": dict(dur=40.0, respiros=[(3.2, .5), (10.4, .6), (16.6, .5), (27.0, .7), (36.6, .45)],
                     papeles=["amanecer", "amanecer", "piano", "piano", "dia", "dia", "dia", "dia",
                              "dia", "salida", "noche", "noche", "subida", "final"]),
    "corto":    dict(dur=15.0, respiros=[(1.6, .5), (5.0, .55), (10.2, .6)],
                     papeles=["amanecer", "piano", "dia", "salida", "final"]),
}

rng = np.random.default_rng(20260922)


def midi(n):
    return 440.0 * 2.0 ** ((n - 69) / 12.0)


# ---------------------------------------------------------------- lienzo
DUR = 40.0                         # lo fija el corte elegido, en main()
left = np.zeros(1, dtype=np.float64)
right = np.zeros(1, dtype=np.float64)


def lienzo(dur):
    global DUR, left, right
    DUR = dur
    n = int(SR * (dur + 2.5))      # cola para que la reverberación no se corte
    left = np.zeros(n, dtype=np.float64)
    right = np.zeros(n, dtype=np.float64)


def place(buf, sig, t0):
    i = int(t0 * SR)
    if i >= len(buf):
        return
    n = min(len(sig), len(buf) - i)
    buf[i:i + n] += sig[:n]


def stereo(sig, t0, pan=0.0, gain=1.0):
    """pan: -1 izquierda, +1 derecha"""
    l = gain * np.sqrt((1.0 - pan) / 2.0) * np.sqrt(2)
    r = gain * np.sqrt((1.0 + pan) / 2.0) * np.sqrt(2)
    place(left, sig * l, t0)
    place(right, sig * r, t0)


# ---------------------------------------------------------------- timbres
def piano(note, dur, vel=1.0):
    """Cuerda percutida: armónicos que se apagan más rápido cuanto más agudos."""
    f = midi(note)
    n = int(SR * dur)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for h in range(1, 13):
        # Ligera inarmonicidad, como en un piano real
        fh = f * h * (1.0 + 0.0009 * h * h)
        if fh > SR / 2.2:
            break
        amp = vel * (0.62 ** (h - 1)) * (1.0 / (1.0 + 0.25 * h))
        decay = 2.6 / (1.0 + 0.55 * h)
        out += amp * np.sin(2 * np.pi * fh * t + rng.uniform(0, 0.4)) * np.exp(-t / decay)
    attack = np.clip(t / 0.004, 0, 1)                 # golpe del macillo
    body = np.exp(-t / (3.2 + 0.004 * (72 - note)))   # los graves duran más
    return out * attack * body * 0.16


def pad(notes, dur, vel=1.0):
    """Colchón cálido: varias voces ligeramente desafinadas entre sí."""
    n = int(SR * dur)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for note in notes:
        f = midi(note)
        for det in (-0.12, 0.0, 0.11):
            ff = f * (1 + det / 100.0)
            vib = 1 + 0.0016 * np.sin(2 * np.pi * 0.23 * t + rng.uniform(0, 6))
            out += np.sin(2 * np.pi * ff * t * vib)
            out += 0.22 * np.sin(2 * np.pi * 2 * ff * t * vib)
    out /= max(1, len(notes) * 3)
    atk, rel = 0.85, 1.6
    env = np.clip(t / atk, 0, 1) * np.clip((dur - t) / rel, 0, 1)
    return out * env * vel * 0.30


def bass(note, dur, vel=1.0):
    f = midi(note)
    n = int(SR * dur)
    t = np.arange(n) / SR
    sig = np.sin(2 * np.pi * f * t) + 0.16 * np.sin(2 * np.pi * 2 * f * t)
    env = np.clip(t / 0.03, 0, 1) * np.exp(-t / (dur * 0.55)) * np.clip((dur - t) / 0.18, 0, 1)
    return np.tanh(sig * 1.25) * env * vel * 0.30


def kick(vel=1.0):
    n = int(SR * 0.42)
    t = np.arange(n) / SR
    f = 118 * np.exp(-t / 0.035) + 46
    sig = np.sin(2 * np.pi * np.cumsum(f) / SR)
    return sig * np.exp(-t / 0.13) * vel * 0.34


def hat(vel=1.0, dur=0.055):
    n = int(SR * dur)
    t = np.arange(n) / SR
    noise = rng.normal(0, 1, n)
    noise = np.diff(np.concatenate([[0.0], noise]))   # realce de agudos
    return noise * np.exp(-t / (dur * 0.34)) * vel * 0.055


def swell(dur, vel=1.0):
    """Respiración de ruido: el aire entre secciones."""
    n = int(SR * dur)
    t = np.arange(n) / SR
    noise = rng.normal(0, 1, n)
    k = 320
    noise = np.convolve(noise, np.ones(k) / k, mode="same")   # queda muy suave
    env = (t / dur) ** 2.2 * np.clip((dur - t) / 0.35, 0, 1)
    return noise * env * vel * 0.9


# ---------------------------------------------------------------- armonía
# vi · IV · I · V en Re mayor: cálido, sin dramatismo
CHORDS = {
    "Bm7":   dict(pad=[59, 62, 66, 69], bass=47, color=[66, 69, 71, 74]),
    "Gmaj7": dict(pad=[55, 59, 62, 66], bass=43, color=[62, 66, 71, 74]),
    "Dmaj7": dict(pad=[57, 62, 66, 69], bass=38, color=[66, 69, 73, 74]),
    "A":     dict(pad=[57, 61, 64, 69], bass=45, color=[64, 69, 73, 76]),
}
CICLO = ["Bm7", "Gmaj7", "Dmaj7", "A"]


def build(papeles, respiros):
    for b, papel in enumerate(papeles):
        t0 = b * BAR
        name = "Dmaj7" if papel == "final" else CICLO[b % 4]
        ch = CHORDS[name]
        col = ch["color"]

        # --- Colchón: siempre presente, con el cuerpo que pida la escena
        if papel != "final":
            vel = dict(amanecer=.50, piano=.72, dia=.85, salida=.80, noche=.58, subida=.70)[papel]
            stereo(pad(ch["pad"], BAR * 1.18, vel), t0, pan=-0.38, gain=1.0)
            stereo(pad([n + 12 for n in ch["pad"][:2]], BAR * 1.18, vel * 0.42), t0, pan=0.44)

        # --- Bajo: sostiene el tramo del día y la vuelta final
        if papel in ("piano", "dia", "salida", "subida"):
            stereo(bass(ch["bass"], SPB * 2.6, 0.9), t0)
            stereo(bass(ch["bass"], SPB * 1.6, 0.6), t0 + SPB * 2.5)

        # --- Piano: el motivo, más o menos abierto según el momento
        if papel == "amanecer":
            stereo(piano(col[0], 3.2, 0.55), t0 + SPB * 0.5, pan=-0.14)
        elif papel == "piano":
            for k, (beat, note, v) in enumerate([(0, col[0], .8), (1.5, col[1], .62), (2.5, col[2], .7)]):
                stereo(piano(note, 2.6, v), t0 + SPB * beat, pan=-0.24 + 0.16 * k)
        elif papel in ("dia", "salida"):
            motif = [(0, col[0], .85), (1, col[2], .6), (1.5, col[1], .68),
                     (2.5, col[3], .74), (3.25, col[1], .5)]
            for k, (beat, note, v) in enumerate(motif):
                stereo(piano(note, 2.4, v), t0 + SPB * beat, pan=-0.26 + 0.13 * k)
        elif papel == "noche":
            stereo(piano(col[0], 3.4, 0.62), t0 + SPB * 0.5, pan=-0.16)
            stereo(piano(col[2], 3.0, 0.45), t0 + SPB * 2.5, pan=0.24)
        elif papel == "subida":
            for k, (beat, note, v) in enumerate([(0, col[0], .9), (1.5, col[2], .7), (3, col[3], .8)]):
                stereo(piano(note, 3.6, v), t0 + SPB * beat, pan=-0.2 + 0.2 * k)

        # --- Percusión: sólo el día, y se retira antes de la noche
        if papel in ("dia", "salida"):
            fade = 1.0 if papel == "dia" else 0.45
            for beat in range(4):
                if beat in (0, 2):
                    stereo(kick(0.92 * fade), t0 + SPB * beat)
                stereo(hat(0.9 * fade), t0 + SPB * beat, pan=0.42)
                stereo(hat(0.5 * fade), t0 + SPB * (beat + 0.5), pan=-0.40)

        # --- Acorde de cierre, dejado sonar sobre el logo
        if papel == "final":
            largo = min(5.0, DUR + 1.8 - t0)
            stereo(pad(ch["pad"], largo, 0.70), t0, pan=-0.30)
            stereo(piano(col[3] if col[3] > 72 else 74, largo, 0.72), t0 + 0.05, pan=0.22)
            stereo(piano(col[0], largo, 0.58), t0 + 0.05, pan=-0.24)
            stereo(bass(ch["bass"], min(3.4, largo), 0.85), t0 + 0.05)

    # --- Respiraciones de ruido en los cambios de escena
    for t0, v in respiros:
        stereo(swell(1.35, v), max(0.0, t0 - 1.35), pan=0.0)


def reverb(sig, seed, decay=1.55, mix=0.26):
    """Sala cálida: convolución con una cola de ruido que se apaga."""
    r = np.random.default_rng(seed)
    n = int(SR * decay)
    t = np.arange(n) / SR
    ir = r.normal(0, 1, n) * np.exp(-t / (decay * 0.34))
    ir[: int(SR * 0.012)] = 0.0                    # pre-retardo
    k = 64
    ir = np.convolve(ir, np.ones(k) / k, mode="same")   # apaga los agudos del reflejo
    ir /= np.abs(ir).sum() / 12.0
    wet = np.fft.irfft(np.fft.rfft(sig, len(sig) + n) * np.fft.rfft(ir, len(sig) + n))[: len(sig)]
    return sig * (1 - mix) + wet * mix


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cut", default="completo", choices=sorted(CORTES))
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    plan = CORTES[args.cut]
    out_path = args.out or f"teaser/out/rumbo-teaser-musica-{args.cut}.wav"
    lienzo(plan["dur"])
    build(plan["papeles"], plan["respiros"])

    l = reverb(left, 11)
    r = reverb(right, 29)

    # Recorta a la duración exacta y cierra con un desvanecido limpio
    n = int(SR * DUR)
    l, r = l[:n], r[:n]
    t = np.arange(n) / SR
    fade = np.clip(t / 0.35, 0, 1) * np.clip((DUR - t) / 1.4, 0, 1)
    l *= fade
    r *= fade

    mix = np.stack([l, r], axis=1)
    mix = np.tanh(mix * 1.08)                       # limitador suave
    peak = np.abs(mix).max()
    mix *= (10 ** (-1.5 / 20)) / peak               # deja -1,5 dBFS de margen

    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    data = (mix * 32767).astype("<i2")
    with wave.open(str(out), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())

    rms = float(np.sqrt((mix ** 2).mean()))
    print(f"✔ {out}  ·  {args.cut}  ·  {DUR:.0f} s  ·  {BPM:.0f} BPM  ·  pico {20*np.log10(peak if peak else 1):.1f} dB  ·  RMS {20*np.log10(rms):.1f} dBFS")


if __name__ == "__main__":
    main()
