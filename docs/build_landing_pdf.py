# Gera docs/landing.pdf a partir de docs/landing.html usando o Chrome/Edge
# instalado (print-to-pdf). A landing tem @media print própria: preserva as
# cores, revela os blocos animados e evita cortes.
# Rode: python docs/build_landing_pdf.py
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'landing.html')
OUT = os.path.join(HERE, 'landing.pdf')

CANDIDATOS = [
    r'C:\Program Files\Google\Chrome\Application\chrome.exe',
    r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
    r'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
    r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
]


def navegador():
    for p in CANDIDATOS:
        if os.path.exists(p):
            return p
    sys.exit('Chrome/Edge não encontrado — instale um deles ou ajuste CANDIDATOS.')


def main():
    exe = navegador()
    cmd = [
        exe, '--headless=new', '--disable-gpu', '--no-pdf-header-footer',
        '--virtual-time-budget=6000',          # deixa o CSS/JS assentar antes de imprimir
        f'--print-to-pdf={OUT}',
        f'file:///{SRC.replace(os.sep, "/")}',
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if not os.path.exists(OUT):
        sys.exit(f'Falhou ao gerar o PDF.\n{r.stderr[-800:]}')
    print(f'PDF gerado: {OUT} - {os.path.getsize(OUT)} bytes (via {os.path.basename(exe)})')


if __name__ == '__main__':
    main()
