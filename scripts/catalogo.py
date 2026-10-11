"""Fonte única do catálogo padrão. Gera supabase/migrations/*_catalogo_padrao.sql.
Uso: python3 scripts/catalogo.py
"""
from pathlib import Path

# (nome, grupo, ilustração, peso_corporal, descrição)
CATALOGO = [
    # Peito
    ("Supino reto com barra", "peito", "supino-reto", False, "Deitado no banco, desça a barra até o meio do peito e empurre até estender os cotovelos. Escápulas encaixadas."),
    ("Supino reto com halteres", "peito", "banco-halteres", False, "Halteres alinhados ao peito; desça com controle e empurre unindo levemente no alto."),
    ("Supino inclinado com barra", "peito", "supino-inclinado", False, "Banco a 30–45°. Desça a barra na parte alta do peito. Ênfase no peitoral superior."),
    ("Supino inclinado com halteres", "peito", "banco-halteres", False, "Banco inclinado a 30–45°. Amplitude completa, sem bater os halteres."),
    ("Supino declinado com barra", "peito", "supino-reto", False, "Banco declinado, pés presos. Desça a barra na parte baixa do peito."),
    ("Supino máquina", "peito", "maquina", False, "Ajuste o banco para a pegada ficar na linha do peito. Empurre sem travar os cotovelos."),
    ("Crucifixo reto com halteres", "peito", "banco-halteres", False, "Cotovelos levemente flexionados; abra os braços em arco até alongar o peito e volte."),
    ("Crucifixo inclinado com halteres", "peito", "banco-halteres", False, "Mesmo movimento do crucifixo, com o banco inclinado a 30°."),
    ("Peck deck (voador)", "peito", "peck-deck", False, "Costas apoiadas, una os braços à frente contraindo o peito e volte devagar."),
    ("Crossover", "peito", "polia", False, "Polias altas; traga as mãos para baixo e à frente, cruzando levemente."),
    ("Flexão de braço", "peito", "colchonete", True, "Corpo alinhado, mãos um pouco além dos ombros. Desça o peito até perto do chão."),
    # Costas
    ("Puxada frontal", "costas", "puxada", False, "Pegada aberta; puxe a barra até a parte alta do peito, levando os cotovelos para baixo."),
    ("Puxada com triângulo", "costas", "puxada", False, "Pegada neutra fechada; puxe até o peito mantendo o tronco estável."),
    ("Puxada supinada", "costas", "puxada", False, "Palmas para você, pegada na largura dos ombros. Puxe até o queixo passar a barra."),
    ("Remada baixa", "costas", "remada-baixa", False, "Sentado, coluna neutra; puxe o triângulo até o abdômen unindo as escápulas."),
    ("Remada curvada com barra", "costas", "barra", False, "Tronco inclinado ~45°, coluna neutra. Puxe a barra até o umbigo."),
    ("Remada unilateral com halter (serrote)", "costas", "banco-halteres", False, "Joelho e mão apoiados no banco; puxe o halter em direção ao quadril."),
    ("Remada cavalinho", "costas", "barra", False, "Barra T entre as pernas; puxe até o peito com o tronco firme."),
    ("Pulldown na polia", "costas", "polia", False, "Braços estendidos, leve a barra da polia até as coxas sem dobrar os cotovelos."),
    ("Barra fixa", "costas", "barra-fixa", True, "Pendure-se com pegada pronada e suba até o queixo passar a barra."),
    ("Levantamento terra", "costas", "barra", False, "Barra próxima às canelas, coluna neutra; levante estendendo quadril e joelhos juntos."),
    # Ombros
    ("Desenvolvimento com halteres", "ombros", "halteres", False, "Sentado, halteres na altura das orelhas; empurre para cima sem arquear a lombar."),
    ("Desenvolvimento com barra", "ombros", "barra", False, "Barra à frente na altura do queixo; empurre até estender os braços."),
    ("Desenvolvimento máquina", "ombros", "maquina", False, "Ajuste o banco para a pegada ficar na altura dos ombros."),
    ("Elevação lateral", "ombros", "halteres", False, "Cotovelos levemente flexionados, eleve os braços até a linha dos ombros."),
    ("Elevação frontal", "ombros", "halteres", False, "Eleve o halter à frente até a altura dos ombros, sem balançar o tronco."),
    ("Crucifixo inverso (voador inverso)", "ombros", "peck-deck", False, "De frente para o encosto, abra os braços para trás trabalhando o deltoide posterior."),
    ("Remada alta", "ombros", "barra", False, "Pegada fechada; puxe a barra até o peito com os cotovelos acima das mãos."),
    ("Face pull", "ombros", "polia", False, "Corda na polia alta; puxe em direção ao rosto abrindo os cotovelos."),
    ("Encolhimento com halteres", "ombros", "halteres", False, "Braços estendidos; eleve os ombros em direção às orelhas e segure 1 segundo."),
    # Bíceps
    ("Rosca direta com barra", "biceps", "barra", False, "Cotovelos colados ao corpo; suba a barra sem balançar o tronco."),
    ("Rosca alternada com halteres", "biceps", "halteres", False, "Alterne os braços girando o punho (supinação) durante a subida."),
    ("Rosca martelo", "biceps", "halteres", False, "Pegada neutra (palmas para dentro). Trabalha também o braquiorradial."),
    ("Rosca Scott", "biceps", "banco-scott", False, "Braços apoiados no banco Scott; desça até quase estender e suba controlando."),
    ("Rosca concentrada", "biceps", "halteres", False, "Sentado, cotovelo apoiado na parte interna da coxa. Movimento lento."),
    ("Rosca na polia", "biceps", "polia", False, "Barra na polia baixa; cotovelos fixos ao lado do corpo."),
    # Tríceps
    ("Tríceps pulley", "triceps", "polia", False, "Barra na polia alta; estenda os cotovelos mantendo-os junto ao corpo."),
    ("Tríceps corda", "triceps", "polia", False, "Corda na polia alta; no final, afaste as pontas da corda."),
    ("Tríceps testa", "triceps", "barra", False, "Deitado, desça a barra em direção à testa flexionando só os cotovelos."),
    ("Tríceps francês", "triceps", "halteres", False, "Halter atrás da cabeça com as duas mãos; estenda os braços para cima."),
    ("Tríceps coice", "triceps", "halteres", False, "Tronco inclinado, cotovelo fixo ao lado do corpo; estenda o braço para trás."),
    ("Mergulho nas paralelas", "triceps", "barra-fixa", True, "Tronco reto para ênfase no tríceps; desça até 90° nos cotovelos."),
    # Antebraço
    ("Rosca de punho", "antebraco", "barra", False, "Antebraços apoiados nas coxas; flexione apenas os punhos."),
    # Quadríceps
    ("Agachamento livre", "quadriceps", "rack", False, "Barra nas costas, pés na largura dos ombros. Desça com joelhos alinhados aos pés."),
    ("Agachamento no smith", "quadriceps", "smith", False, "Barra guiada; posicione os pés um pouco à frente do corpo."),
    ("Leg press 45°", "quadriceps", "leg-press", False, "Pés na largura do quadril; desça até ~90° sem tirar a lombar do encosto."),
    ("Agachamento hack", "quadriceps", "hack", False, "Costas apoiadas; desça controlando até ~90° nos joelhos."),
    ("Cadeira extensora", "quadriceps", "cadeira", False, "Joelho alinhado ao eixo da máquina; estenda as pernas e segure 1 segundo."),
    ("Afundo com halteres", "quadriceps", "halteres", False, "Passo à frente; desça até os dois joelhos formarem ~90°."),
    ("Agachamento búlgaro", "quadriceps", "halteres", False, "Pé de trás apoiado no banco; desça com o tronco levemente inclinado."),
    # Posterior
    ("Mesa flexora", "posterior", "mesa-flexora", False, "Deitado de bruços, rolo acima dos calcanhares; flexione os joelhos sem tirar o quadril."),
    ("Cadeira flexora", "posterior", "cadeira", False, "Sentado, rolo atrás dos calcanhares; flexione os joelhos até ~90°."),
    ("Stiff", "posterior", "barra", False, "Joelhos semiflexionados; desça a barra rente às pernas levando o quadril para trás."),
    # Glúteos
    ("Elevação pélvica", "gluteos", "barra", False, "Costas apoiadas no banco, barra no quadril; suba até alinhar tronco e coxas."),
    ("Glúteo na polia (coice)", "gluteos", "polia", False, "Tornozeleira na polia baixa; estenda o quadril para trás sem arquear a lombar."),
    ("Cadeira abdutora", "gluteos", "cadeira", False, "Afaste as pernas contra a resistência e volte devagar."),
    # Adutores
    ("Cadeira adutora", "adutores", "cadeira", False, "Una as pernas contra a resistência, controlando a volta."),
    ("Agachamento sumô com halter", "adutores", "halteres", False, "Pés bem afastados e pontas para fora; halter entre as pernas."),
    # Panturrilha
    ("Panturrilha em pé", "panturrilha", "panturrilha", False, "Ponta dos pés na plataforma; suba o máximo e desça alongando."),
    ("Panturrilha sentado", "panturrilha", "panturrilha-sentado", False, "Joelhos sob o apoio; trabalha mais o sóleo."),
    ("Panturrilha no leg press", "panturrilha", "leg-press", False, "Pontas dos pés na base da plataforma; empurre só com os tornozelos."),
    # Abdômen
    ("Abdominal (crunch)", "abdomen", "colchonete", True, "Deitado, joelhos flexionados; eleve as escápulas contraindo o abdômen."),
    ("Abdominal infra (elevação de pernas)", "abdomen", "colchonete", True, "Deitado, eleve as pernas sem tirar a lombar do chão."),
    ("Abdominal oblíquo", "abdomen", "colchonete", True, "Leve o cotovelo em direção ao joelho oposto, alternando."),
    ("Abdominal na polia", "abdomen", "polia", False, "Ajoelhado, corda atrás da cabeça; flexione o tronco para baixo."),
    ("Prancha", "abdomen", "colchonete", True, "Apoio nos antebraços e pontas dos pés, corpo alinhado. Registre o tempo nas repetições (segundos)."),
    # Cardio
    ("Esteira", "cardio", "esteira", True, "Registre o tempo em minutos nas repetições."),
    ("Bicicleta ergométrica", "cardio", "bicicleta", True, "Ajuste o banco na altura do quadril. Registre o tempo em minutos."),
    ("Elíptico", "cardio", "eliptico", True, "Movimento contínuo, postura ereta. Registre o tempo em minutos."),
]

CREDIT = "Ilustração própria BoraTreinar (licença MIT)"

def q(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"

def main():
    names = [c[0].lower() for c in CATALOGO]
    assert len(names) == len(set(names)), "nomes duplicados no catálogo"
    rows = ",\n".join(
        f"  ({q(n)}, {q(g)}, {q(d)}, {q('/catalogo/' + img + '.svg')}, {q(CREDIT)}, {'true' if bw else 'false'}, true)"
        for n, g, img, bw, d in CATALOGO
    )
    sql = f"""-- Catálogo padrão de equipamentos/exercícios (gerado por scripts/catalogo.py).
-- Ilustrações próprias em public/catalogo/. Idempotente.
insert into public.equipment (name, muscle_group, description, image_url, image_credit, is_bodyweight, is_default)
values
{rows}
on conflict (lower(name)) where is_default do update set
  muscle_group = excluded.muscle_group,
  description = excluded.description,
  image_url = excluded.image_url,
  image_credit = excluded.image_credit,
  is_bodyweight = excluded.is_bodyweight;
"""
    out = Path(__file__).resolve().parent.parent / "supabase" / "migrations" / "20261010132945_catalogo_padrao.sql"
    out.write_text(sql, encoding="utf-8")
    print(f"{len(CATALOGO)} itens → {out.name}")

if __name__ == "__main__":
    main()
