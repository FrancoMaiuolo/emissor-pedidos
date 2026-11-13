"""Uso: ~/.artvozzi/srt-to-planilha/venv/bin/python3 fonte/publicar_script.py "descrição"
Cria (ou atualiza) o Apps Script ligado à planilha MASTER_MG e publica como aplicativo da web.
Estado (ids) em ~/.artvozzi/mastermg-appsscript.json, para atualizar sem duplicar."""
import json, os, sys
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

BASE = os.path.dirname(os.path.abspath(__file__))
SID = "1JIvhLaFGOyygNtAl_w37eiplUBVwL8L-xEsd7zH6UsE"
ESTADO = os.path.expanduser("~/.artvozzi/mastermg-appsscript.json")

cred = Credentials.from_authorized_user_file(os.path.expanduser("~/.artvozzi/google-token-appsscript.json"))
script = build("script", "v1", credentials=cred, cache_discovery=False)
sheets = build("sheets", "v4", credentials=cred, cache_discovery=False).spreadsheets()

senha = open(os.path.expanduser("~/.artvozzi/mastermg-senha.txt")).read().strip()
codigo = open(os.path.join(BASE, "appsscript/Code.gs"), encoding="utf-8").read()
assert codigo.count("@@SENHA@@") == 1
codigo = codigo.replace("@@SENHA@@", senha)
manifesto = open(os.path.join(BASE, "appsscript/appsscript.json"), encoding="utf-8").read()

estado = json.load(open(ESTADO)) if os.path.exists(ESTADO) else {}

# coluna R "ID interno" em PEDIDOS (evita gravar duas vezes o mesmo pedido quando o celular reenvia)
cab = sheets.values().get(spreadsheetId=SID, range="PEDIDOS!R1").execute().get("values")
if not cab:
    pid = next(s["properties"]["sheetId"] for s in sheets.get(spreadsheetId=SID).execute()["sheets"] if s["properties"]["title"] == "PEDIDOS")
    sheets.values().update(spreadsheetId=SID, range="PEDIDOS!R1", valueInputOption="RAW", body={"values": [["ID interno"]]}).execute()
    sheets.batchUpdate(spreadsheetId=SID, body={"requests": [
        {"repeatCell": {"range": {"sheetId": pid, "startRowIndex": 0, "endRowIndex": 1, "startColumnIndex": 17, "endColumnIndex": 18},
                        "cell": {"userEnteredFormat": {"backgroundColor": {"red": .2, "green": .4, "blue": 1},
                                                       "textFormat": {"bold": True, "foregroundColor": {"red": 1, "green": 1, "blue": 1}}}},
                        "fields": "userEnteredFormat(backgroundColor,textFormat)"}},
        {"setBasicFilter": {"filter": {"range": {"sheetId": pid, "startRowIndex": 0, "startColumnIndex": 0, "endColumnIndex": 18}}}},
    ]}).execute()
    print("coluna ID interno criada")

if "scriptId" not in estado:
    estado["scriptId"] = script.projects().create(body={"title": "MASTER_MG — ponte do Emissor", "parentId": SID}).execute()["scriptId"]
    print("projeto criado", estado["scriptId"])
sid = estado["scriptId"]

script.projects().updateContent(scriptId=sid, body={"files": [
    {"name": "Code", "type": "SERVER_JS", "source": codigo},
    {"name": "appsscript", "type": "JSON", "source": manifesto},
]}).execute()
versao = script.projects().versions().create(scriptId=sid, body={"description": sys.argv[1] if len(sys.argv) > 1 else "atualização"}).execute()["versionNumber"]
cfg = {"versionNumber": versao, "manifestFileName": "appsscript", "description": "Emissor de Pedidos"}
if "deploymentId" in estado:
    dep = script.projects().deployments().update(scriptId=sid, deploymentId=estado["deploymentId"], body={"deploymentConfig": cfg}).execute()
else:
    dep = script.projects().deployments().create(scriptId=sid, body=cfg).execute()
    estado["deploymentId"] = dep["deploymentId"]
url = next((e["webApp"]["url"] for e in dep.get("entryPoints", []) if e.get("entryPointType") == "WEB_APP"), None)
estado["url"] = url
json.dump(estado, open(ESTADO, "w"), indent=2)
os.chmod(ESTADO, 0o600)
print("versão", versao)
print("URL", url)
print("EDITOR https://script.google.com/d/%s/edit" % sid)
