# Emissor de Pedidos MASTER MG — manutenção

| Peça | Onde |
|---|---|
| Página (fonte) | `fonte/emissor.html` → montada em `index.html` por `fonte/montar.py` |
| Página publicada | https://francomaiuolo.github.io/emissor-pedidos/ (GitHub Pages, branch `main`) |
| Banco de dados | Planilha `MASTER_MG — Pedidos e Clientes`, pasta `MASTER_MG` do Meu Drive da `producao@artvozzi.com` |
| Ponte página ↔ planilha | Apps Script ligado à planilha (`fonte/appsscript/`), publicado por `fonte/publicar_script.py` |
| Segredos (fora do repo) | `~/.artvozzi/mastermg-senha.txt` (senha da planilha) · `~/.artvozzi/mastermg-appsscript.json` (ids e URL) · `~/.artvozzi/google-token-appsscript.json` |

## Mudou a página
```bash
python3 fonte/montar.py      # gera index.html; recusa se a senha aparecer na página
git add index.html fonte/ && git commit && git push
```

## Mudou o Apps Script
```bash
~/.artvozzi/srt-to-planilha/venv/bin/python3 fonte/publicar_script.py "o que mudou"
```
Atualiza o mesmo endereço; a página não precisa mudar. Se o Google pedir de novo
autorização (escopo novo no `appsscript.json`), abrir o endereço `/exec` logado na `producao@` e permitir.

## Cuidados
- ⛔ A senha nunca entra no `index.html` nem no repositório (o repositório é público).
- A planilha está em pt_BR: fórmula escrita pela API usa `;`, não `,`.
- "Valor do pedido" = valor da mercadoria, não a comissão da MASTER MG.
