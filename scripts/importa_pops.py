# Converte PDFs de POP (documentos .docx exportados) em SQL de carga da tabela `pops`.
#
# Gera arquivos "insert ... on conflict (clinic_id, numero)" — idempotentes — que
# o admin aplica no SQL Editor do Supabase. Usado na carga inicial dos 57 POPs.
#
#   python -I scripts/importa_pops.py <pasta_pdfs> <saida.sql> [saida.json]
#
# Mapeamento: secao do documento (OBJETIVO, MATERIAIS, PASSO A PASSO...) -> bloco
# (subtitulo); sub-secao "A. Protocolo" -> linha (col1 = rotulo, col2 = HTML).

import html
import json
import os
import re
import sys
import unicodedata

import pypdf

sys.stdout.reconfigure(encoding="utf-8")

# --- rotulos de secao reconhecidos (ordem importa: mais especifico primeiro) ---
SECOES = [
    "OBJETIVO", "ALCANCE", "CONTEXTO", "DEFINIÇÕES", "DEFINICOES",
    "RESPONSABILIDADES", "RESPONSABILIDADE", "RESPONSÁVEL", "EXECUTANTE",
    "EQUIPAMENTO DE PROTEÇÃO INDIVIDUAL (EPI)", "EQUIPAMENTO DE PROTEÇÃO INDIVIDUAL",
    "MATERIAIS NECESSÁRIOS", "MATERIAIS",
    "TIPOS DE BIOESTIMULADORES", "TIPOS DE TRATAMENTO",
    "PRINCIPAIS INDICAÇÕES", "INDICAÇÕES", "INDICAÇÃO",
    "PRINCIPAIS CONTRA-INDICAÇÕES", "PRINCIPAIS CONTRAINDICAÇÕES",
    "PRINCIPAL CONTRA-INDICAÇÃO", "CONTRA-INDICAÇÕES", "CONTRAINDICAÇÕES",
    "PASSO A PASSO",
    "TEMPO DE APLICAÇÃO", "TEMPERATURA DO EQUIPAMENTO",
    "NÚMERO DE SESSÕES E INTERVALO ENTRE AS SESSÕES",
    "INTERVALO SUGERIDO ENTRE AS SESSÕES", "NÚMERO DE SESSÕES", "FREQUÊNCIA",
    "APLICAÇÃO DE MÚLTIPLAS ÁREAS",
    "FALTA DE ENERGIA ELÉTRICA / PLANO DE CONTINGÊNCIA",
    "ÉTICA PROFISSIONAL", "RECOMENDAÇÕES", "ATENÇÃO", "ATENCÃO",
    "OBSERVAÇÕES", "OBSERVAÇÃO", "OBERVAÇÕES",
    "REFERÊNCIAS LITERÁRIAS", "REFERÊNCIAS",
]

RODAPE = re.compile(
    r"É\s*expressamente\s*proibida.*?(?:documento\.?|$)", re.IGNORECASE | re.DOTALL)
APROVACAO = re.compile(
    r"(?:GEN\s+)?POP\s+ELABORADO\s+POR:.*$", re.IGNORECASE | re.DOTALL)
# Cabecalho de pagina completo (com o quadro Codigo/Versao/Data/Proxima Revisao)
CAB_COMPLETO = re.compile(
    r"\d*\s*PROCEDIMENTO\s+OPERACIONAL\s+PAD[RÃ]ÃO.*?Pr[óo]xima\s+Revis[ãa]o:\s*_*\s*/?\s*_*\s*/?\s*_*",
    re.IGNORECASE | re.DOTALL)
# Cabecalho curto: "PROCEDIMENTO OPERACIONAL PADRÃO – POP <TITULO>"
CAB_CURTO = re.compile(
    r"\d*\s*PROCEDIMENTO\s+OPERACIONAL\s+PAD[RÃ]ÃO\s*(?:[–\-]\s*POP)?\s*",
    re.IGNORECASE)

SUBSECAO = re.compile(r"(?:^|\s)([A-HJ-Z])\.\s+([A-ZÁÂÃÀÉÊÍÓÔÕÚÇ][^.:;]{2,60}?)\s*(?=[:\n]|\s[A-ZÁ-Ú●\-])")


def norm(s: str) -> str:
    """Normaliza o espacamento quebrado da extracao de PDF."""
    s = s.replace("\u00a0", " ").replace("\r", "\n")
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r" *\n *", "\n", s)
    return s.strip()


def limpa(txt: str) -> str:
    txt = norm(txt)
    txt = RODAPE.sub(" ", txt)
    txt = CAB_COMPLETO.sub(" ", txt)
    txt = CAB_CURTO.sub(" ", txt)
    txt = re.sub(r"(?m)^\s*\d+\s*$", " ", txt)          # numeros de pagina soltos
    txt = re.sub(r"Total\s+de\s+p[áa]ginas:\s*\d*", " ", txt, flags=re.I)
    txt = re.sub(r"C[óo]digo\s+POP\s*n[ºo°]?:", " ", txt, flags=re.I)
    txt = re.sub(r"\bVers[ãa]o:", " ", txt, flags=re.I)
    txt = re.sub(r"\bData:", " ", txt, flags=re.I)
    txt = re.sub(r"Assinatura:", " ", txt, flags=re.I)
    # Cabecalho alternativo (documentos no formato "PROTOCOLO")
    txt = re.sub(r"PROTOCOLO\s+C[óo]digo\s+\d+\s+Edi[çc][ãa]o\s+\w+", " ", txt, flags=re.I)
    txt = re.sub(r"P[áa]gina\s+\d+\s+de\s+\d+", " ", txt, flags=re.I)
    txt = re.sub(r"\bData\s+\d{2}/\d{2}/\d{4}", " ", txt, flags=re.I)
    txt = re.sub(r"\s+", " ", txt)   # offsets consistentes p/ a divisão em seções
    return txt.strip()


def titulo_de(nome_arquivo: str) -> str:
    base = re.sub(r"\.docx\.pdf$|\.pdf$", "", nome_arquivo, flags=re.I).strip()
    base = re.sub(r"^POP\s+", "", base, flags=re.I).strip()
    return base


def esc(s: str) -> str:
    return html.escape(s, quote=False)


def para_html(trecho: str) -> str:
    """Converte um trecho de texto em HTML: listas para '●' e paragrafos."""
    trecho = trecho.strip(" ;:.-")
    if not trecho:
        return ""
    partes = [p.strip() for p in re.split(r"\s*●\s*", trecho)]
    cabeca, itens = partes[0], [p for p in partes[1:] if p]
    out = []
    if cabeca:
        out.append(f"<p>{esc(cabeca)}</p>")
    if itens:
        lis = "".join(f"<li>{esc(i)}</li>" for i in itens)
        out.append(f"<ul>{lis}</ul>")
    return "".join(out)


# Secao numerada sem dois-pontos: "1 – OBJETIVO", "2 - ALCANCE" (formato PROTOCOLO)
SECAO_NUM_INICIO = re.compile(r"\b\d{1,2}\s*[–—-]\s*(?=[A-ZÁÂÃÀÉÊÍÓÔÕÚÇ])")


def rotulo_caixa_alta(txt: str, pos: int, max_tokens: int = 20) -> str:
    """Le o titulo da secao: a sequencia de palavras em CAIXA ALTA a partir de pos."""
    palavras = []
    for token in txt[pos:].split(" ")[:max_tokens]:
        if not token:
            break
        letras = "".join(c for c in token if c.isalpha())
        if not letras:                            # marcador (●, -) ja e conteudo
            break
        if letras.upper() != letras:              # palavra em minuscula: fim do titulo
            break
        palavras.append(token)
        if token.endswith(":"):
            break
    return " ".join(palavras).strip(" :.-")


def secoes_do_texto(txt: str):
    """Quebra o texto nas secoes conhecidas. Devolve [(rotulo, conteudo)]."""
    alt = "|".join(re.escape(s) for s in SECOES)
    padrao = re.compile(rf"\b({alt})\s*:", re.IGNORECASE)
    marcas = list(padrao.finditer(txt))

    # Fallback: documentos no formato "PROTOCOLO", com secoes numeradas.
    if len(marcas) <= 1:
        numeradas = list(SECAO_NUM_INICIO.finditer(txt))
        if len(numeradas) > len(marcas):
            res = []
            intro = txt[: numeradas[0].start()].strip()
            if intro:
                res.append(("", intro))
            for i, m in enumerate(numeradas):
                fim = numeradas[i + 1].start() if i + 1 < len(numeradas) else len(txt)
                rotulo = rotulo_caixa_alta(txt, m.end())
                inicio_corpo = m.end() + len(rotulo)
                res.append((rotulo.upper(), txt[inicio_corpo: fim].strip()))
            return res

    if not marcas:
        return [("", txt)]
    res = []
    intro = txt[: marcas[0].start()].strip()
    if intro:
        res.append(("", intro))
    for i, m in enumerate(marcas):
        fim = marcas[i + 1].start() if i + 1 < len(marcas) else len(txt)
        rotulo = m.group(1).upper()
        res.append((rotulo, txt[m.end(): fim].strip()))
    return res


def linhas_da_secao(conteudo: str):
    """Sub-secoes 'A. Titulo' viram linhas com rotulo; o resto, linha inteira."""
    marcas = list(SUBSECAO.finditer(conteudo))
    if not marcas:
        corpo = para_html(conteudo)
        return [{"col1": "", "col2": corpo}] if corpo else []
    linhas = []
    antes = conteudo[: marcas[0].start()].strip()
    if antes:
        h = para_html(antes)
        if h:
            linhas.append({"col1": "", "col2": h})
    for i, m in enumerate(marcas):
        fim = marcas[i + 1].start() if i + 1 < len(marcas) else len(conteudo)
        rotulo = f"{m.group(1)}. {m.group(2).strip()}"
        corpo = para_html(conteudo[m.end(): fim].strip())
        linhas.append({"col1": f"<p>{esc(rotulo)}</p>", "col2": corpo})
    return linhas


def monta_estrutura(txt: str):
    blocos = []
    for i, (rotulo, conteudo) in enumerate(secoes_do_texto(txt)):
        linhas = linhas_da_secao(conteudo)
        if not linhas:
            continue
        blocos.append({
            "id": f"b{i+1}",
            "subtitulo": rotulo or "DESCRIÇÃO",
            "linhas": linhas,
        })
    return blocos


def main():
    pasta, saida_sql = sys.argv[1], sys.argv[2]
    saida_json = sys.argv[3] if len(sys.argv) > 3 else None

    arquivos = sorted(
        [f for f in os.listdir(pasta) if f.lower().endswith(".pdf")],
        key=lambda s: unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower(),
    )

    registros = []
    for idx, nome in enumerate(arquivos, start=1):
        r = pypdf.PdfReader(os.path.join(pasta, nome))
        bruto = "\n".join((p.extract_text() or "") for p in r.pages)
        txt = limpa(APROVACAO.sub(" ", limpa(bruto)))
        estrutura = monta_estrutura(txt)
        registros.append({
            "numero": f"{idx:03d}/2026",
            "titulo": titulo_de(nome),
            "arquivo": nome,
            "paginas": len(r.pages),
            "blocos": len(estrutura),
            "chars": len(txt),
            "estrutura": estrutura,
        })

    if saida_json:
        with open(saida_json, "w", encoding="utf-8") as f:
            json.dump(registros, f, ensure_ascii=False, indent=1)

    # Grava em partes, para o SQL Editor nao receber um texto gigante de uma vez.
    POR_PARTE = 20
    partes = [registros[i:i + POR_PARTE] for i in range(0, len(registros), POR_PARTE)]
    base, ext = os.path.splitext(saida_sql)
    for n, parte in enumerate(partes, start=1):
        cab = [
            f"-- {os.path.basename(base)}_parte{n} — carga dos POPs ({parte[0]['numero']} a {parte[-1]['numero']})",
            "-- Origem: documentos .docx/PDF da clínica. Aditivo e idempotente:",
            "-- regrava título/estrutura do POP de mesmo número (clinic_id, numero).",
            "",
            "insert into pops (clinic_id, numero, titulo, estrutura) values",
        ]
        valores = []
        for reg in parte:
            est = json.dumps(reg["estrutura"], ensure_ascii=False).replace("'", "''")
            tit = reg["titulo"].replace("'", "''")
            valores.append(
                f"  ((select id from clinics order by created_at limit 1), "
                f"'{reg['numero']}', '{tit}', '{est}'::jsonb)"
            )
        cab.append(",\n".join(valores))
        cab.append("on conflict (clinic_id, numero) do update set")
        cab.append("  titulo = excluded.titulo,")
        cab.append("  estrutura = excluded.estrutura,")
        cab.append("  updated_at = now();")
        cab.append("")
        destino = f"{base}_parte{n}{ext}"
        with open(destino, "w", encoding="utf-8") as f:
            f.write("\n".join(cab))
        print(f"  parte {n}: {len(parte)} POPs -> {os.path.basename(destino)} ({os.path.getsize(destino)//1024} KB)")

    print(f"{len(registros)} POPs gerados -> {saida_sql} ({os.path.getsize(saida_sql)} bytes)")
    fracos = [r for r in registros if r["blocos"] <= 1 or r["chars"] < 400]
    print(f"POPs com estrutura fraca (revisar): {len(fracos)}")
    for r in fracos:
        print(f"  {r['numero']} {r['titulo'][:45]:45} blocos={r['blocos']} chars={r['chars']}")


if __name__ == "__main__":
    main()
