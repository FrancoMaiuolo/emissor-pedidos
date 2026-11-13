/**
 * MASTER_MG — ponte entre o Emissor de Pedidos (página pública) e esta planilha.
 * A página só lê/grava com a SENHA. Roda como a conta dona da planilha.
 *
 * Ações (POST, corpo JSON em text/plain):
 *   { senha, acao: 'dados', ano }         -> compradores e vendedores ativos + último nº do ano
 *   { senha, acao: 'registrar', pedido }  -> grava PEDIDOS + ITENS e cadastra cliente novo
 */
const SENHA = '@@SENHA@@';

function doGet() {
  return json({ ok: true, app: 'MASTER_MG' });
}

function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (x) { return json({ ok: false, erro: 'pedido inválido' }); }
  if (req.senha !== SENHA) return json({ ok: false, erro: 'senha' });
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  try {
    if (req.acao === 'dados') {
      return json({ ok: true, compradores: lerCadastro(ss, 'COMPRADORES'), vendedores: lerCadastro(ss, 'VENDEDORES'),
                    ultimo: ultimoNumero(ss, Number(req.ano)) });
    }
    if (req.acao === 'registrar') {
      const lock = LockService.getScriptLock();
      lock.waitLock(20000);
      try { return json(registrar(ss, req.pedido)); } finally { lock.releaseLock(); }
    }
    return json({ ok: false, erro: 'ação desconhecida' });
  } catch (x) {
    return json({ ok: false, erro: String(x && x.message || x) });
  }
}

/** Rode esta função UMA vez pelo editor (Executar) para autorizar o acesso à planilha. */
function autorizar() {
  Logger.log('Autorizado: ' + SpreadsheetApp.getActiveSpreadsheet().getName());
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

const norm = s => String(s || '').trim().toUpperCase();

// COMPRADORES / VENDEDORES: Nome curto | Razão social | Endereço | Bairro/CEP/Cidade | CNPJ | IE | Contato | Ativo
function lerCadastro(ss, aba) {
  const sh = ss.getSheetByName(aba);
  const n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, 8).getDisplayValues()
    .filter(l => l[0] && norm(l[7]) !== 'NÃO')
    .map(l => ({ apelido: l[0], razao: l[1], endereco: l[2], local: l[3], cnpj: l[4], ie: l[5], contato: l[6] }));
}

// PEDIDOS: A=Nº  B=Ano
function ultimoNumero(ss, ano) {
  const sh = ss.getSheetByName('PEDIDOS');
  const n = sh.getLastRow();
  if (n < 2) return null;
  let max = null;
  sh.getRange(2, 1, n - 1, 2).getValues().forEach(([num, a]) => {
    if (Number(a) === ano && Number(num) > (max || 0)) max = Number(num);
  });
  return max;
}

function cadastrarSeNovo(ss, aba, c) {
  if (!c || !c.apelido) return;
  const sh = ss.getSheetByName(aba);
  const n = sh.getLastRow();
  const existentes = n < 2 ? [] : sh.getRange(2, 1, n - 1, 1).getDisplayValues().map(l => norm(l[0]));
  if (existentes.indexOf(norm(c.apelido)) >= 0) return;   // já existe: não sobrescreve o que foi editado na planilha
  sh.appendRow([c.apelido, c.razao || '', c.endereco || '', c.local || '', c.cnpj || '', c.ie || '', '', 'SIM']);
}

function dataLocal(iso) {           // "2026-11-13" -> Date (sem fuso deslocar o dia)
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d);
}

// PEDIDOS (18 col.): Nº|Ano|Data|Mês|Comprador|CNPJ c.|Vendedor|CNPJ v.|Frete|Destino|Prazo|Nº itens|Valor|Situação|Gerado por|Gerado em|Obs|ID interno
// ITENS (13 col.):   Nº|Data|Mês|Comprador|Vendedor|Unidade|Qtd|Descrição|Marca|Preço|ICMS|Valor|Situação
function registrar(ss, p) {
  const shP = ss.getSheetByName('PEDIDOS'), shI = ss.getSheetByName('ITENS');
  const n = shP.getLastRow();
  const linhas = n < 2 ? [] : shP.getRange(2, 1, n - 1, 18).getValues();
  if (linhas.some(l => l[17] === p.id)) return { ok: true, repetido: true };   // reenvio do mesmo pedido: ignora

  const ano = Number(p.data.slice(0, 4));
  const repetido = linhas.some(l => Number(l[0]) === Number(p.numero) && Number(l[1]) === ano && norm(l[13]) !== 'CANCELADO');
  const data = dataLocal(p.data), mes = new Date(data.getFullYear(), data.getMonth(), 1);
  const total = p.itens.reduce((a, it) => a + it.qtd * it.preco, 0);

  shP.appendRow([Number(p.numero), ano, data, mes, p.comprador.apelido, p.comprador.cnpj || '', p.vendedor.apelido, p.vendedor.cnpj || '',
                 p.frete, p.destino, Number(p.dias), p.itens.length, total, 'EMITIDO', p.geradoPor || '', new Date(),
                 repetido ? 'ATENÇÃO: já existia outro pedido com este número' : '', p.id]);
  const lp = shP.getLastRow();
  shP.getRange(lp, 3).setNumberFormat('dd/mm/yyyy');
  shP.getRange(lp, 4).setNumberFormat('mmm/yyyy');
  shP.getRange(lp, 13).setNumberFormat('"R$" #,##0.00');
  shP.getRange(lp, 16).setNumberFormat('dd/mm/yyyy hh:mm');
  p.itens.forEach(it => {
    shI.appendRow([Number(p.numero), data, mes, p.comprador.apelido, p.vendedor.apelido, it.unidade,
                   it.qtd, it.produto, it.marca, it.preco, it.icms, it.qtd * it.preco, 'EMITIDO']);
    const li = shI.getLastRow();
    shI.getRange(li, 2).setNumberFormat('dd/mm/yyyy');
    shI.getRange(li, 3).setNumberFormat('mmm/yyyy');
    shI.getRange(li, 7).setNumberFormat(Number.isInteger(it.qtd) ? '#,##0' : '#,##0.###');
    shI.getRange(li, 10).setNumberFormat('"R$" #,##0.00');
    shI.getRange(li, 12).setNumberFormat('"R$" #,##0.00');
  });
  cadastrarSeNovo(ss, 'COMPRADORES', p.comprador);
  cadastrarSeNovo(ss, 'VENDEDORES', p.vendedor);
  return { ok: true, repetido, ultimo: ultimoNumero(ss, ano) };
}
