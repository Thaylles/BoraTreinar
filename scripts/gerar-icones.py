#!/usr/bin/env python3
"""Gera os SVGs do logo/ícones do BoraTreinar a partir de um único desenho.

Losango verde-amarelo (bandeira) com o círculo azul e um halter inclinado,
com anilhas em dois tamanhos, pegada recartilhada e travas amarelas.

Uso: python3 scripts/gerar-icones.py
Os PNGs (favicon, apple-icon, ícones do PWA) são renderizados a partir destes SVGs.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

DEFS = """<defs>
    <linearGradient id="bt-plate" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="0.55" stop-color="#EEF1F6"/>
      <stop offset="1" stop-color="#C9D1DE"/>
    </linearGradient>
    <linearGradient id="bt-bar" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="1" stop-color="#B8C2D3"/>
    </linearGradient>
    <linearGradient id="bt-collar" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFD866"/>
      <stop offset="1" stop-color="#E6A800"/>
    </linearGradient>
    <radialGradient id="bt-sky" cx="0.4" cy="0.35" r="0.75">
      <stop offset="0" stop-color="#0B3A9E"/>
      <stop offset="1" stop-color="#002776"/>
    </radialGradient>
  </defs>"""


def plate(x: float, w: float, h: float) -> str:
    """Anilha centrada verticalmente em 256, com brilho na borda esquerda."""
    y = 256 - h / 2
    r = min(w / 2.4, 14)
    return (
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="url(#bt-plate)"/>'
        f'<rect x="{x + 4}" y="{y + 8}" width="{max(w * 0.18, 3):.1f}" height="{h - 16}" rx="2" fill="#FFFFFF" opacity="0.9"/>'
    )


def dumbbell() -> str:
    """Halter desenhado na horizontal em torno de (256,256); inclinado e reduzido para caber no círculo."""
    parts = []
    # barra (passa por dentro das anilhas)
    parts.append('<rect x="124" y="245" width="264" height="22" rx="11" fill="url(#bt-bar)"/>')
    # pegada recartilhada
    parts.append('<rect x="210" y="240" width="92" height="32" rx="10" fill="#F4F6FA"/>')
    knurl = "".join(f'<rect x="{x}" y="244" width="4" height="24" rx="2" fill="#AEB8C9"/>' for x in range(218, 296, 11))
    parts.append(knurl)
    # travas amarelas
    parts.append('<rect x="196" y="234" width="16" height="44" rx="5" fill="url(#bt-collar)"/>')
    parts.append('<rect x="300" y="234" width="16" height="44" rx="5" fill="url(#bt-collar)"/>')
    # anilhas grandes e pequenas
    parts.append(plate(154, 42, 156))
    parts.append(plate(316, 42, 156))
    parts.append(plate(124, 30, 112))
    parts.append(plate(358, 30, 112))
    # pontas da barra
    parts.append('<rect x="108" y="242" width="18" height="28" rx="7" fill="url(#bt-bar)"/>')
    parts.append('<rect x="386" y="242" width="18" height="28" rx="7" fill="url(#bt-bar)"/>')
    body = "\n      ".join(parts)
    # sombra com o mesmo contorno do halter
    shadow = re.sub(r'fill="[^"]+"', 'fill="#000F33"', body).replace('opacity="0.9"', "")
    return f"""<g transform="rotate(-22 256 256) translate(256 256) scale(0.76) translate(-256 -256)">
    <g transform="translate(8 12)" opacity="0.38">
      {shadow}
    </g>
    <g>
      {body}
    </g>
  </g>"""


def stars() -> str:
    """Algumas estrelas do céu da bandeira (somem nos tamanhos pequenos)."""
    pts = [(196, 318, 4), (226, 336, 3), (300, 328, 4), (322, 306, 3), (262, 346, 3.5), (184, 196, 3), (330, 190, 3)]
    return "".join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="#FFFFFF" opacity="0.55"/>' for x, y, r in pts)


def icon(maskable: bool) -> str:
    # Maskable: fundo sangrado e conteúdo dentro da zona segura (80%).
    bg = '<rect width="512" height="512" fill="#009C3B"/>' if maskable else '<rect width="512" height="512" rx="112" fill="#009C3B"/>'
    inner = f"""<path d="M256 70 L452 256 L256 442 L60 256 Z" fill="#FFC72C"/>
  <path d="M256 70 L452 256 L256 442 L60 256 Z" fill="none" stroke="#E6A800" stroke-width="6" stroke-linejoin="round"/>
  <circle cx="256" cy="256" r="118" fill="url(#bt-sky)"/>
  {stars()}
  {dumbbell()}"""
    if maskable:
        inner = f'<g transform="translate(256 256) scale(0.8) translate(-256 -256)">\n  {inner}\n  </g>'
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  {DEFS}
  {bg}
  {inner}
</svg>
"""


def main() -> None:
    normal = icon(maskable=False)
    for p in ["public/icons/icon.svg", "src/app/icon.svg"]:
        (ROOT / p).write_text(normal, encoding="utf-8")
    (ROOT / "public/icons/icon-maskable.svg").write_text(icon(maskable=True), encoding="utf-8")
    # Mesmo desenho para o componente <LogoMark> (conteúdo interno do <svg>).
    inner = normal.split(">", 1)[1].rsplit("</svg>", 1)[0].strip()
    (ROOT / "src/components/brand/logo-svg.ts").write_text(
        "// Gerado por scripts/gerar-icones.py — não edite à mão.\n"
        f"export const LOGO_SVG_INNER = {json.dumps(inner)};\n",
        encoding="utf-8",
    )
    print("SVGs gerados.")


if __name__ == "__main__":
    main()
