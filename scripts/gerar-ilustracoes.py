"""Gera as ilustrações próprias (SVG) do catálogo padrão em public/catalogo/.

Estilo: flat, paleta BoraTreinar. Licença: MIT, como o resto do projeto.
Uso: python3 scripts/gerar-ilustracoes.py
"""
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "public" / "catalogo"
A = "#002776"  # anil (metal/estrutura)
V = "#009C3B"  # verde (estofado)
Y = "#FFC72C"  # ipê (detalhes)
P = "#FF5A36"  # pitanga (pegadores)
G = "#8C96A8"  # cabo / cinza

def frame(body: str, bg: str = "#FFF3CC") -> str:
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" role="img">
<rect width="240" height="180" rx="20" fill="{bg}"/>
<rect x="16" y="154" width="208" height="6" rx="3" fill="#EADFC4"/>
{body}
</svg>
"""

def plate(x, y, w=12, h=44):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="3" fill="{A}"/><rect x="{x + w/2 - 2}" y="{y + h/2 - 3}" width="4" height="6" rx="1" fill="{Y}"/>'

def barbell(y, x1=28, x2=212):
    return (f'<rect x="{x1}" y="{y - 3}" width="{x2 - x1}" height="6" rx="3" fill="{G}"/>'
            + plate(x1 + 6, y - 22) + plate(x1 + 20, y - 17, 8, 34)
            + plate(x2 - 18, y - 22) + plate(x2 - 28, y - 17, 8, 34))

def dumbbell(cx, cy, s=1.0):
    w = 52 * s
    return (f'<rect x="{cx - w/2}" y="{cy - 3*s}" width="{w}" height="{6*s}" rx="3" fill="{G}"/>'
            f'<rect x="{cx - w/2 - 2}" y="{cy - 13*s}" width="{12*s}" height="{26*s}" rx="3" fill="{A}"/>'
            f'<rect x="{cx + w/2 - 10*s}" y="{cy - 13*s}" width="{12*s}" height="{26*s}" rx="3" fill="{A}"/>')

def bench(x, y, w):
    return (f'<rect x="{x}" y="{y}" width="{w}" height="14" rx="7" fill="{V}"/>'
            f'<rect x="{x + 14}" y="{y + 14}" width="8" height="{154 - y - 14}" fill="{A}"/>'
            f'<rect x="{x + w - 22}" y="{y + 14}" width="8" height="{154 - y - 14}" fill="{A}"/>')

def stack(x, top=40, w=34):
    plates = "".join(f'<rect x="{x + 4}" y="{y}" width="{w - 8}" height="7" rx="2" fill="{A if i % 2 else "#1A3F99"}"/>'
                     for i, y in enumerate(range(top + 50, 150, 9)))
    return (f'<rect x="{x}" y="{top}" width="{w}" height="{154 - top}" rx="4" fill="none" stroke="{A}" stroke-width="5"/>'
            + plates)

def seat(x, y):
    return (f'<rect x="{x}" y="{y}" width="56" height="13" rx="6" fill="{V}"/>'
            f'<rect x="{x + 24}" y="{y + 13}" width="8" height="{154 - y - 13}" fill="{A}"/>'
            f'<rect x="{x + 6}" y="148" width="44" height="6" rx="3" fill="{A}"/>')

ILL = {
    "supino-reto": bench(62, 112, 116)
        + f'<rect x="88" y="62" width="7" height="92" fill="{A}"/><rect x="145" y="62" width="7" height="92" fill="{A}"/>'
        + barbell(62),
    "supino-inclinado": seat(70, 124)
        + f'<rect x="96" y="108" width="84" height="14" rx="7" fill="{V}" transform="rotate(-35 104 118)"/>'
        + f'<rect x="150" y="42" width="7" height="112" fill="{A}"/>'
        + barbell(44),
    "banco-halteres": bench(62, 118, 116) + dumbbell(80, 72, 0.9) + dumbbell(160, 72, 0.9),
    "halteres": dumbbell(84, 112, 1.3) + dumbbell(156, 84, 1.3)
        + f'<rect x="54" y="132" width="132" height="10" rx="5" fill="{A}"/><rect x="62" y="142" width="8" height="12" fill="{A}"/><rect x="170" y="142" width="8" height="12" fill="{A}"/>',
    "barra": barbell(132, 24, 216),
    "polia": f'<rect x="26" y="30" width="16" height="124" rx="4" fill="{A}"/><rect x="198" y="30" width="16" height="124" rx="4" fill="{A}"/>'
        + f'<rect x="26" y="24" width="188" height="10" rx="5" fill="{A}"/>'
        + f'<circle cx="52" cy="48" r="8" fill="{Y}" stroke="{A}" stroke-width="3"/><circle cx="188" cy="48" r="8" fill="{Y}" stroke="{A}" stroke-width="3"/>'
        + f'<path d="M58 52 L108 104 M182 52 L132 104" stroke="{G}" stroke-width="3"/>'
        + f'<rect x="98" y="102" width="16" height="10" rx="4" fill="{P}"/><rect x="126" y="102" width="16" height="10" rx="4" fill="{P}"/>',
    "peck-deck": stack(150, 30) + seat(70, 116)
        + f'<rect x="90" y="56" width="14" height="60" rx="6" fill="{V}"/>'
        + f'<rect x="58" y="44" width="12" height="54" rx="6" fill="{V}"/><rect x="124" y="44" width="12" height="54" rx="6" fill="{V}"/>'
        + f'<path d="M64 44 L64 34 L150 34 M130 44 L130 34" stroke="{A}" stroke-width="5" fill="none"/>',
    "puxada": stack(160, 30) + seat(80, 122)
        + f'<rect x="84" y="102" width="48" height="10" rx="5" fill="{V}"/>'
        + f'<rect x="100" y="24" width="64" height="8" rx="4" fill="{A}"/>'
        + f'<path d="M108 32 L108 54" stroke="{G}" stroke-width="3"/>'
        + f'<rect x="58" y="52" width="100" height="6" rx="3" fill="{G}"/><rect x="58" y="50" width="14" height="10" rx="4" fill="{P}"/><rect x="144" y="50" width="14" height="10" rx="4" fill="{P}"/>',
    "remada-baixa": f'<rect x="40" y="128" width="150" height="12" rx="6" fill="{V}"/><rect x="40" y="140" width="150" height="14" fill="{A}"/>'
        + f'<rect x="180" y="70" width="14" height="70" rx="4" fill="{A}"/><circle cx="187" cy="120" r="7" fill="{Y}" stroke="{A}" stroke-width="3"/>'
        + f'<rect x="164" y="96" width="10" height="34" rx="3" fill="{A}" transform="rotate(-20 169 113)"/>'
        + f'<path d="M180 120 L120 112" stroke="{G}" stroke-width="3"/><rect x="104" y="104" width="18" height="14" rx="5" fill="{P}"/>',
    "leg-press": f'<path d="M40 150 L180 40" stroke="{A}" stroke-width="10" stroke-linecap="round"/>'
        + f'<rect x="130" y="54" width="44" height="40" rx="6" fill="{G}" transform="rotate(-38 152 74)"/>'
        + f'<rect x="150" y="34" width="12" height="38" rx="4" fill="{A}" transform="rotate(-38 156 53)"/>'
        + f'<rect x="42" y="116" width="54" height="14" rx="7" fill="{V}"/><rect x="34" y="78" width="14" height="48" rx="7" fill="{V}" transform="rotate(-25 41 102)"/>'
        + f'<rect x="56" y="130" width="8" height="24" fill="{A}"/>',
    "hack": f'<path d="M60 150 L150 30" stroke="{A}" stroke-width="10" stroke-linecap="round"/>'
        + f'<rect x="78" y="70" width="16" height="64" rx="7" fill="{V}" transform="rotate(37 86 102)"/>'
        + f'<rect x="96" y="52" width="30" height="10" rx="5" fill="{V}" transform="rotate(37 111 57)"/>'
        + f'<rect x="120" y="138" width="80" height="16" rx="4" fill="{G}"/>',
    "cadeira": stack(170, 40) + seat(76, 110)
        + f'<rect x="76" y="56" width="14" height="60" rx="7" fill="{V}" transform="rotate(-10 83 86)"/>'
        + f'<path d="M132 116 L150 140" stroke="{A}" stroke-width="7" stroke-linecap="round"/>'
        + f'<rect x="138" y="132" width="34" height="14" rx="7" fill="{V}"/><path d="M90 60 L170 60" stroke="{A}" stroke-width="5"/>',
    "mesa-flexora": f'<rect x="30" y="98" width="150" height="14" rx="7" fill="{V}" transform="rotate(-6 105 105)"/>'
        + f'<rect x="60" y="112" width="8" height="42" fill="{A}"/><rect x="150" y="104" width="8" height="50" fill="{A}"/>'
        + f'<path d="M180 94 L204 120" stroke="{A}" stroke-width="7" stroke-linecap="round"/><rect x="186" y="112" width="34" height="14" rx="7" fill="{V}"/>'
        + f'<rect x="34" y="78" width="26" height="8" rx="4" fill="{P}"/>',
    "rack": f'<rect x="40" y="26" width="10" height="128" fill="{A}"/><rect x="190" y="26" width="10" height="128" fill="{A}"/>'
        + f'<rect x="40" y="24" width="160" height="8" rx="4" fill="{A}"/>'
        + "".join(f'<circle cx="45" cy="{y}" r="2" fill="{Y}"/><circle cx="195" cy="{y}" r="2" fill="{Y}"/>' for y in range(44, 150, 12))
        + f'<rect x="50" y="68" width="10" height="6" fill="{G}"/><rect x="180" y="68" width="10" height="6" fill="{G}"/>'
        + barbell(64, 22, 218),
    "smith": f'<rect x="40" y="26" width="10" height="128" fill="{A}"/><rect x="190" y="26" width="10" height="128" fill="{A}"/>'
        + f'<rect x="40" y="24" width="160" height="8" rx="4" fill="{A}"/>'
        + f'<rect x="62" y="32" width="4" height="122" fill="{G}"/><rect x="174" y="32" width="4" height="122" fill="{G}"/>'
        + f'<rect x="58" y="74" width="12" height="16" rx="3" fill="{Y}"/><rect x="170" y="74" width="12" height="16" rx="3" fill="{Y}"/>'
        + barbell(82, 22, 218),
    "panturrilha": f'<rect x="150" y="28" width="16" height="126" rx="4" fill="{A}"/>'
        + f'<rect x="96" y="54" width="60" height="8" fill="{A}"/>'
        + f'<rect x="88" y="62" width="22" height="14" rx="7" fill="{V}"/><rect x="128" y="62" width="22" height="14" rx="7" fill="{V}"/>'
        + f'<path d="M86 154 L86 136 L146 136 L156 154 Z" fill="{G}"/>',
    "panturrilha-sentado": seat(70, 118)
        + f'<rect x="120" y="96" width="44" height="12" rx="6" fill="{V}"/><rect x="160" y="70" width="10" height="84" fill="{A}"/>'
        + f'<path d="M118 154 L118 140 L170 140 L176 154 Z" fill="{G}"/>' + plate(176, 84, 12, 40),
    "barra-fixa": f'<rect x="50" y="34" width="10" height="120" fill="{A}"/><rect x="180" y="34" width="10" height="120" fill="{A}"/>'
        + f'<rect x="40" y="34" width="160" height="8" rx="4" fill="{G}"/>'
        + f'<rect x="60" y="96" width="40" height="7" rx="3" fill="{P}"/><rect x="140" y="96" width="40" height="7" rx="3" fill="{P}"/>',
    "colchonete": f'<rect x="34" y="136" width="172" height="16" rx="8" fill="{V}"/>'
        + f'<path d="M34 144 L206 144" stroke="#006B29" stroke-width="2" stroke-dasharray="6 6"/>'
        + f'<circle cx="182" cy="110" r="22" fill="{Y}" stroke="{A}" stroke-width="3"/><path d="M162 104 Q182 116 202 104" stroke="{A}" stroke-width="3" fill="none"/>',
    "banco-scott": f'<rect x="104" y="64" width="64" height="16" rx="8" fill="{V}" transform="rotate(35 136 72)"/>'
        + f'<rect x="120" y="86" width="10" height="68" fill="{A}"/><rect x="60" y="112" width="56" height="12" rx="6" fill="{V}"/><rect x="84" y="124" width="8" height="30" fill="{A}"/>'
        + f'<path d="M150 104 l12 -6 l12 6 l12 -6 l12 6" stroke="{G}" stroke-width="5" fill="none"/>' + plate(198, 82, 10, 34) + plate(140, 82, 10, 34),
    "maquina": stack(160, 36) + seat(70, 118)
        + f'<rect x="70" y="62" width="14" height="58" rx="7" fill="{V}"/>'
        + f'<path d="M84 52 L150 52 M116 52 L116 30" stroke="{A}" stroke-width="5" fill="none"/>'
        + f'<rect x="56" y="44" width="16" height="10" rx="4" fill="{P}"/><rect x="126" y="44" width="16" height="10" rx="4" fill="{P}"/>',
    "esteira": f'<path d="M30 146 L176 128 L184 140 L36 154 Z" fill="{A}"/><path d="M40 146 L174 130" stroke="{G}" stroke-width="4"/>'
        + f'<path d="M176 128 L196 50" stroke="{A}" stroke-width="8" stroke-linecap="round"/>'
        + f'<rect x="168" y="36" width="46" height="24" rx="6" fill="{A}"/><rect x="174" y="42" width="22" height="8" rx="2" fill="{Y}"/>'
        + f'<path d="M150 88 L192 72" stroke="{P}" stroke-width="5" stroke-linecap="round"/>',
    "bicicleta": f'<path d="M60 150 L180 150" stroke="{A}" stroke-width="8" stroke-linecap="round"/>'
        + f'<path d="M80 150 L100 70 M100 70 L160 96 L164 150 M100 70 L96 56" stroke="{A}" stroke-width="8" stroke-linecap="round" fill="none"/>'
        + f'<rect x="78" y="48" width="36" height="10" rx="5" fill="{V}"/>'
        + f'<circle cx="138" cy="118" r="20" fill="none" stroke="{G}" stroke-width="6"/><circle cx="138" cy="118" r="4" fill="{Y}"/>'
        + f'<path d="M160 96 L176 46" stroke="{A}" stroke-width="7" stroke-linecap="round"/><rect x="164" y="38" width="30" height="8" rx="4" fill="{P}"/>',
    "eliptico": f'<path d="M30 150 L210 150" stroke="{A}" stroke-width="8" stroke-linecap="round"/>'
        + f'<circle cx="62" cy="120" r="26" fill="{G}"/><circle cx="62" cy="120" r="6" fill="{Y}"/>'
        + f'<path d="M70 132 L150 118 M80 108 L160 128" stroke="{A}" stroke-width="7" stroke-linecap="round"/>'
        + f'<rect x="136" y="110" width="30" height="10" rx="4" fill="{V}"/><rect x="146" y="124" width="30" height="10" rx="4" fill="{V}"/>'
        + f'<path d="M168 150 L178 40" stroke="{A}" stroke-width="8" stroke-linecap="round"/>'
        + f'<path d="M150 40 L164 120 M196 40 L184 110" stroke="{P}" stroke-width="5" stroke-linecap="round"/>',
}

if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name, body in ILL.items():
        (OUT / f"{name}.svg").write_text(frame(body), encoding="utf-8")
    print(f"{len(ILL)} ilustrações geradas em {OUT}")
