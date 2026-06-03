# Gera docs/MANUAL_ADMIN.pdf a partir de docs/MANUAL_ADMIN.md
# com a identidade visual da clínica (logo + cor teal). Sem dependência de rede.
import re, os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
                                Image, PageBreak, HRFlowable)

HERE = os.path.dirname(os.path.abspath(__file__))
MD = os.path.join(HERE, 'MANUAL_ADMIN.md')
OUT = os.path.join(HERE, 'MANUAL_ADMIN.pdf')
LOGO = os.path.join(HERE, '..', 'Geny.jpg')

TEAL = colors.HexColor('#0f766e')
SLATE = colors.HexColor('#0f172a')
GRAY = colors.HexColor('#64748b')
LIGHT = colors.HexColor('#e2e8f0')

EMOJI = {'📅':'', '✨':'', '🎉':'', '☰':'(menu)', '✅':'[ok]', '⚠️':'Atenção:', '⚠':'Atenção:',
         '👉':'>', '×':'x', '🔐':'', '🔔':'', '💚':'', '✓':'-', '→':'->'}

def clean(s: str) -> str:
    for k, v in EMOJI.items():
        s = s.replace(k, v)
    return s.encode('cp1252', 'ignore').decode('cp1252')

def inline(text: str) -> str:
    text = clean(text)
    text = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    text = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)
    text = re.sub(r'`(.+?)`', r'<font face="Courier" size="8.5">\1</font>', text)
    return text

styles = getSampleStyleSheet()
S = {
    'title': ParagraphStyle('t', parent=styles['Title'], textColor=TEAL, fontSize=24, leading=28),
    'sub': ParagraphStyle('s', parent=styles['Normal'], textColor=GRAY, fontSize=11, leading=15, alignment=1),
    'h1': ParagraphStyle('h1', parent=styles['Heading1'], textColor=TEAL, fontSize=15, leading=19, spaceBefore=14, spaceAfter=6),
    'h2': ParagraphStyle('h2', parent=styles['Heading2'], textColor=SLATE, fontSize=12, leading=16, spaceBefore=8, spaceAfter=4),
    'body': ParagraphStyle('b', parent=styles['Normal'], textColor=SLATE, fontSize=9.5, leading=14, alignment=TA_LEFT, spaceAfter=4),
    'bullet': ParagraphStyle('bu', parent=styles['Normal'], textColor=SLATE, fontSize=9.5, leading=14, leftIndent=12, bulletIndent=2, spaceAfter=2),
    'quote': ParagraphStyle('q', parent=styles['Normal'], textColor=GRAY, fontSize=9, leading=13, leftIndent=10, fontName='Helvetica-Oblique', spaceAfter=4, borderColor=LIGHT),
    'cell': ParagraphStyle('c', parent=styles['Normal'], textColor=SLATE, fontSize=8.5, leading=11),
    'cellh': ParagraphStyle('ch', parent=styles['Normal'], textColor=colors.white, fontSize=8.5, leading=11, fontName='Helvetica-Bold'),
}

story = []
# Capa
if os.path.exists(LOGO):
    try:
        story.append(Image(LOGO, width=42*mm, height=27*mm))
    except Exception:
        pass
story.append(Spacer(1, 8*mm))
story.append(Paragraph('Manual do Administrador', S['title']))
story.append(Spacer(1, 3*mm))
story.append(Paragraph('Sistema de Gestão — Instituto Geny Freitas', S['sub']))
story.append(Spacer(1, 2*mm))
story.append(Paragraph('Navegação e funcionalidades · Junho/2026', S['sub']))
story.append(Spacer(1, 2*mm))
story.append(Paragraph('https://defy-clinicas.vercel.app', S['sub']))
story.append(PageBreak())

lines = open(MD, encoding='utf-8').read().splitlines()
i = 0
n = len(lines)
avail = A4[0] - 36*mm  # largura útil

def flush_table(block):
    rows = [[c.strip() for c in r.strip().strip('|').split('|')] for r in block]
    if len(rows) >= 2 and set(rows[1][0].replace('-', '').replace(':', '')) <= {''}:
        header = rows[0]; body = rows[2:]
    else:
        header = rows[0]; body = rows[1:]
    ncol = len(header)
    data = [[Paragraph(inline(c), S['cellh']) for c in header]]
    for r in body:
        r = (r + [''] * ncol)[:ncol]
        data.append([Paragraph(inline(c), S['cell']) for c in r])
    cw = [avail / ncol] * ncol
    t = Table(data, colWidths=cw, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), TEAL),
        ('GRID', (0, 0), (-1, -1), 0.4, LIGHT),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
    ]))
    story.append(Spacer(1, 2))
    story.append(t)
    story.append(Spacer(1, 6))

while i < n:
    line = lines[i].rstrip()
    if not line.strip():
        i += 1; continue
    if line.startswith('# '):
        i += 1; continue  # título já está na capa
    if line.startswith('### '):
        story.append(Paragraph(inline(line[4:]), S['h2'])); i += 1; continue
    if line.startswith('## '):
        story.append(Paragraph(inline(line[3:]), S['h1'])); i += 1; continue
    if line.startswith('---'):
        story.append(Spacer(1, 3)); story.append(HRFlowable(width='100%', thickness=0.6, color=LIGHT)); story.append(Spacer(1, 3)); i += 1; continue
    if line.lstrip().startswith('|'):
        block = []
        while i < n and lines[i].lstrip().startswith('|'):
            block.append(lines[i]); i += 1
        flush_table(block); continue
    if line.startswith('> '):
        story.append(Paragraph(inline(line[2:]), S['quote'])); i += 1; continue
    if line.lstrip().startswith('- '):
        story.append(Paragraph(inline(line.lstrip()[2:]), S['bullet'], bulletText='–')); i += 1; continue
    story.append(Paragraph(inline(line), S['body'])); i += 1

def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont('Helvetica', 7.5)
    canvas.setFillColor(GRAY)
    canvas.drawString(18*mm, 12*mm, 'Instituto Geny Freitas — Manual do Administrador')
    canvas.drawRightString(A4[0]-18*mm, 12*mm, f'Página {doc.page}')
    canvas.restoreState()

doc = SimpleDocTemplate(OUT, pagesize=A4, leftMargin=18*mm, rightMargin=18*mm, topMargin=16*mm, bottomMargin=18*mm,
                        title='Manual do Administrador — Instituto Geny Freitas')
doc.build(story, onLaterPages=footer, onFirstPage=lambda c, d: None)
print('PDF gerado:', OUT, '-', os.path.getsize(OUT), 'bytes')
