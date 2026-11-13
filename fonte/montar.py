"""Monta o index.html publicado a partir de fonte/emissor.html.

Embute o jsPDF, as fontes Liberation Serif (recortadas) e o endereço do Apps Script.
Uso:  python3 fonte/montar.py        (de dentro de ~/WorkSpace/emissor-pedidos)
A senha da planilha NUNCA entra na página: ela é digitada uma vez em cada aparelho.
"""
import base64, json, os

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)

html = open(os.path.join(AQUI, "emissor.html"), encoding="utf-8").read()
js = open(os.path.join(AQUI, "vendor/jspdf.umd.min.js"), encoding="utf-8").read().replace("</script", "<\\/script")
estilos = {"normal": "Regular", "bold": "Bold", "italic": "Italic", "bolditalic": "BoldItalic"}
fontes = {k: base64.b64encode(open(os.path.join(AQUI, f"fontes/sub-{v}.ttf"), "rb").read()).decode() for k, v in estilos.items()}
url = json.load(open(os.path.expanduser("~/.artvozzi/mastermg-appsscript.json")))["url"]

for marca in ("/*@@JSPDF@@*/", "/*@@FONTES@@*/", "@@API_URL@@"):
    assert html.count(marca) == 1, marca
html = (html.replace("@@API_URL@@", url)
            .replace("/*@@JSPDF@@*/", js)
            .replace("/*@@FONTES@@*/", "const FONTES = " + json.dumps(fontes) + ";"))

senha = open(os.path.expanduser("~/.artvozzi/mastermg-senha.txt")).read().strip()
assert senha not in html, "a senha não pode ir para a página pública"

open(os.path.join(RAIZ, "index.html"), "w", encoding="utf-8").write(html)
print("index.html montado:", len(html) // 1024, "KB")
