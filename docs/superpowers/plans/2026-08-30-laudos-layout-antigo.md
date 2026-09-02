# Layout Antigo de Laudos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restaurar a exibição de `/laudos` no formato antigo (separado por categoria, meses agrupados em uma linha) descrito em `docs/superpowers/specs/2026-08-30-laudos-layout-design.md`.

**Architecture:** O site é HTML estático com JS vanilla embutido (sem bundler, sem framework, sem test runner configurado). A lógica pura de agrupamento/parsing (sem DOM, sem Supabase) fica isolada em `js/laudos-grouping.js`, testável tanto no browser (`<script>` tag, expõe `window.LaudosGrouping`) quanto no Node (`require(...)`, via UMD). Isso permite testes reais com `node` puro (`assert`), sem introduzir Jest/npm num projeto que hoje não tem nenhuma dependência de build — segue o padrão existente do repositório.

**Tech Stack:** HTML + JS vanilla, Supabase JS SDK v2 (via CDN), Node.js (só para rodar os testes de `js/laudos-grouping.js` com `assert` nativo, sem dependências).

## Global Constraints

- Bases fixas e ordem de exibição: `Bela`, `Polo`, `RPR`, `Apress` (spec seção "Decisões", item 2).
- Frequências possíveis: `Diário`, `Mensal`, `Semestral` (spec item 3).
- Sem aba "Todos" — só as 3 abas de categoria; aba ativa padrão = **Desinfecção** (spec item 4 e 4-bis).
- Base sem laudo naquele mês/frequência: omitida da linha, sem placeholder (spec item 5).
- Agrupamento por ano desc → mês desc dentro do ano (spec item 6).
- Fonte de verdade do mês/ano é o campo `periodo` (texto livre), não `titulo`; parsing case-insensitive; períodos não interpretáveis caem num grupo `"Outros"` no final (spec item 7).
- Campo `resultado` fica fora do escopo — não exibir em nenhuma tela (spec "Fora de escopo").
- Não alterar cabeçalho, selos de confiança ou rodapé de `/laudos` (spec "Fora de escopo").

---

## Task 1: SQL de migração do Supabase (arquivo de referência)

**Files:**
- Create: `sql/2026-08-30-add-base-frequencia.sql`

**Interfaces:**
- Produces: instrução SQL que o cliente (ou quem tiver acesso ao painel do Supabase) precisa rodar manualmente no SQL Editor do Supabase **antes** de usar os campos novos do admin. Nenhum código deste projeto executa esse SQL automaticamente — não há credencial de service-role neste ambiente.

- [ ] **Step 1: Criar o arquivo SQL**

```sql
-- Adiciona colunas usadas pela nova exibição de laudos (por base/frequência).
-- Rodar uma única vez no SQL Editor do Supabase, no projeto aguajato_laudos.
alter table aguajato_laudos
  add column if not exists base text,
  add column if not exists frequencia text;
```

- [ ] **Step 2: Commit**

```bash
git add sql/2026-08-30-add-base-frequencia.sql
git commit -m "chore: adiciona SQL de migração para colunas base/frequencia"
```

---

## Task 2: `js/laudos-grouping.js` — `parsePeriodo`

**Files:**
- Create: `js/laudos-grouping.js`
- Create: `tests/laudos-grouping.test.js`

**Interfaces:**
- Produces: `LaudosGrouping.parsePeriodo(periodo: string) -> {ano: number, mes: number} | null`
  - `mes` é 1-12. Retorna `null` se `periodo` não seguir o padrão `"<nome do mês>/<ano>"` (case-insensitive, com ou sem acento).
- Produces: `LaudosGrouping.MESES_NOMES` — array de 12 strings, `MESES_NOMES[0] === 'janeiro'`, ..., `MESES_NOMES[11] === 'dezembro'`, usado por tarefas futuras para exibir o nome do mês de forma canônica.
- Produces: `LaudosGrouping.BASES_ORDER` — `['Bela', 'Polo', 'RPR', 'Apress']`, usado pelas tarefas 4 e 8-10.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/laudos-grouping.test.js`:

```js
const assert = require('assert');
const { parsePeriodo, MESES_NOMES, BASES_ORDER } = require('../js/laudos-grouping.js');

// parsePeriodo
assert.deepStrictEqual(parsePeriodo('junho/2026'), { ano: 2026, mes: 6 });
assert.deepStrictEqual(parsePeriodo('MAIO/2026'), { ano: 2026, mes: 5 });
assert.deepStrictEqual(parsePeriodo('Março/2025'), { ano: 2025, mes: 3 });
assert.deepStrictEqual(parsePeriodo('marco/2025'), { ano: 2025, mes: 3 });
assert.strictEqual(parsePeriodo('não é um período'), null);
assert.strictEqual(parsePeriodo(''), null);
assert.strictEqual(parsePeriodo(null), null);
assert.strictEqual(parsePeriodo(undefined), null);

assert.strictEqual(MESES_NOMES.length, 12);
assert.strictEqual(MESES_NOMES[0], 'janeiro');
assert.strictEqual(MESES_NOMES[11], 'dezembro');

assert.deepStrictEqual(BASES_ORDER, ['Bela', 'Polo', 'RPR', 'Apress']);

console.log('parsePeriodo: OK');
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `node tests/laudos-grouping.test.js`
Expected: erro `Cannot find module '../js/laudos-grouping.js'`

- [ ] **Step 3: Criar `js/laudos-grouping.js` com a implementação mínima**

```js
/* ============================================
   AGUAJATO – laudos-grouping.js
   Funções puras (sem DOM, sem Supabase) para
   agrupar e classificar laudos. Usado tanto na
   página pública (laudos.html) quanto no painel
   admin (admin/dashboard.html), e testável via
   Node puro (tests/laudos-grouping.test.js).
   ============================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LaudosGrouping = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  const BASES_ORDER = ['Bela', 'Polo', 'RPR', 'Apress'];

  const MESES_NOMES = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];

  const MESES_PT = {
    janeiro: 1, fevereiro: 2, 'março': 3, marco: 3, abril: 4, maio: 5, junho: 6,
    julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12
  };

  function parsePeriodo(periodo) {
    if (!periodo || typeof periodo !== 'string') return null;
    const partes = periodo.trim().split('/');
    if (partes.length !== 2) return null;
    const mesNome = partes[0].trim().toLowerCase();
    const ano = parseInt(partes[1].trim(), 10);
    const mes = MESES_PT[mesNome];
    if (!mes || !ano || Number.isNaN(ano)) return null;
    return { ano, mes };
  }

  return { BASES_ORDER, MESES_NOMES, MESES_PT, parsePeriodo };
});
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `node tests/laudos-grouping.test.js`
Expected: imprime `parsePeriodo: OK` e sai com código 0.

- [ ] **Step 5: Commit**

```bash
git add js/laudos-grouping.js tests/laudos-grouping.test.js
git commit -m "feat: adiciona parsePeriodo para interpretar mês/ano do campo periodo"
```

---

## Task 3: `js/laudos-grouping.js` — `agruparPorAnoMes`

**Files:**
- Modify: `js/laudos-grouping.js`
- Modify: `tests/laudos-grouping.test.js`

**Interfaces:**
- Consumes: `parsePeriodo` (Task 2).
- Produces: `LaudosGrouping.agruparPorAnoMes(laudos: Array<{periodo: string, ...}>) -> Array<{ano: number|null, meses: Array<{mes: number|null, mesNome: string, laudos: Array}>}>`
  - Ordenado por `ano` desc; dentro do ano, `meses` ordenado por `mes` desc.
  - Registros cujo `periodo` não é interpretável por `parsePeriodo` vão para um item final `{ano: null, meses: [{mes: null, mesNome: 'Outros', laudos: [...]}]}` — só aparece se houver pelo menos um registro nessa situação.

- [ ] **Step 1: Escrever o teste que falha**

Adicionar ao final de `tests/laudos-grouping.test.js` (antes do `console.log` final, que deve ser movido para o fim do arquivo):

```js
const { agruparPorAnoMes } = require('../js/laudos-grouping.js');

const laudosTeste = [
  { id: '1', periodo: 'junho/2026' },
  { id: '2', periodo: 'julho/2026' },
  { id: '3', periodo: 'junho/2025' },
  { id: '4', periodo: 'periodo invalido' },
];

const agrupado = agruparPorAnoMes(laudosTeste);

assert.strictEqual(agrupado.length, 3); // 2026, 2025, Outros
assert.strictEqual(agrupado[0].ano, 2026);
assert.strictEqual(agrupado[0].meses.length, 2);
assert.strictEqual(agrupado[0].meses[0].mes, 7); // julho antes de junho (desc)
assert.strictEqual(agrupado[0].meses[0].mesNome, 'julho');
assert.strictEqual(agrupado[0].meses[0].laudos[0].id, '2');
assert.strictEqual(agrupado[0].meses[1].mes, 6);
assert.strictEqual(agrupado[0].meses[1].laudos[0].id, '1');

assert.strictEqual(agrupado[1].ano, 2025);
assert.strictEqual(agrupado[1].meses[0].laudos[0].id, '3');

assert.strictEqual(agrupado[2].ano, null);
assert.strictEqual(agrupado[2].meses[0].mesNome, 'Outros');
assert.strictEqual(agrupado[2].meses[0].laudos[0].id, '4');

// Sem períodos inválidos -> não deve haver grupo "Outros"
const semInvalidos = agruparPorAnoMes([{ id: '1', periodo: 'junho/2026' }]);
assert.strictEqual(semInvalidos.length, 1);

console.log('agruparPorAnoMes: OK');
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `node tests/laudos-grouping.test.js`
Expected: `TypeError: agruparPorAnoMes is not a function` (ou `undefined`).

- [ ] **Step 3: Implementar `agruparPorAnoMes` em `js/laudos-grouping.js`**

Adicionar dentro da função factory, antes do `return { ... }` final, e atualizar o `return` para incluir a nova função:

```js
  function agruparPorAnoMes(laudos) {
    const porAno = new Map();
    const outros = [];

    laudos.forEach(l => {
      const p = parsePeriodo(l.periodo);
      if (!p) { outros.push(l); return; }
      if (!porAno.has(p.ano)) porAno.set(p.ano, new Map());
      const porMes = porAno.get(p.ano);
      if (!porMes.has(p.mes)) porMes.set(p.mes, { mes: p.mes, mesNome: MESES_NOMES[p.mes - 1], laudos: [] });
      porMes.get(p.mes).laudos.push(l);
    });

    const resultado = Array.from(porAno.keys())
      .sort((a, b) => b - a)
      .map(ano => ({
        ano,
        meses: Array.from(porAno.get(ano).values()).sort((a, b) => b.mes - a.mes)
      }));

    if (outros.length) {
      resultado.push({ ano: null, meses: [{ mes: null, mesNome: 'Outros', laudos: outros }] });
    }

    return resultado;
  }
```

E trocar a linha final `return { BASES_ORDER, MESES_NOMES, MESES_PT, parsePeriodo };` por:

```js
  return { BASES_ORDER, MESES_NOMES, MESES_PT, parsePeriodo, agruparPorAnoMes };
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `node tests/laudos-grouping.test.js`
Expected: imprime `parsePeriodo: OK` e `agruparPorAnoMes: OK`, sai com código 0.

- [ ] **Step 5: Commit**

```bash
git add js/laudos-grouping.js tests/laudos-grouping.test.js
git commit -m "feat: adiciona agruparPorAnoMes para organizar laudos por ano/mês"
```

---

## Task 4: `js/laudos-grouping.js` — `linksPorBase`

**Files:**
- Modify: `js/laudos-grouping.js`
- Modify: `tests/laudos-grouping.test.js`

**Interfaces:**
- Consumes: `BASES_ORDER` (Task 2).
- Produces: `LaudosGrouping.linksPorBase(laudos: Array<{base, frequencia, arquivo_url, titulo}>, frequencia: string) -> Array<{base: string, arquivo_url: string, titulo: string}>`
  - Filtra os laudos com `frequencia` igual ao parâmetro, retorna na ordem de `BASES_ORDER`, omitindo bases sem laudo correspondente naquele grupo.

- [ ] **Step 1: Escrever o teste que falha**

Adicionar a `tests/laudos-grouping.test.js`:

```js
const { linksPorBase } = require('../js/laudos-grouping.js');

const mesLaudos = [
  { base: 'RPR', frequencia: 'Mensal', arquivo_url: 'url-rpr-mensal', titulo: 'MENSAL_RPR' },
  { base: 'Bela', frequencia: 'Diário', arquivo_url: 'url-bela-diario', titulo: 'DIARIOS_BELA' },
  { base: 'Polo', frequencia: 'Mensal', arquivo_url: 'url-polo-mensal', titulo: 'MENSAL_POLO' },
];

const mensal = linksPorBase(mesLaudos, 'Mensal');
assert.strictEqual(mensal.length, 2);
assert.strictEqual(mensal[0].base, 'Polo'); // Polo vem antes de RPR em BASES_ORDER
assert.strictEqual(mensal[1].base, 'RPR');

const diario = linksPorBase(mesLaudos, 'Diário');
assert.strictEqual(diario.length, 1);
assert.strictEqual(diario[0].base, 'Bela');

const semestral = linksPorBase(mesLaudos, 'Semestral');
assert.strictEqual(semestral.length, 0);

console.log('linksPorBase: OK');
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `node tests/laudos-grouping.test.js`
Expected: `TypeError: linksPorBase is not a function`.

- [ ] **Step 3: Implementar `linksPorBase`**

Adicionar antes do `return` final:

```js
  function linksPorBase(laudos, frequencia) {
    return BASES_ORDER
      .map(base => laudos.find(l => l.frequencia === frequencia && l.base === base))
      .filter(Boolean)
      .map(l => ({ base: l.base, arquivo_url: l.arquivo_url, titulo: l.titulo }));
  }
```

Atualizar o `return` final para:

```js
  return { BASES_ORDER, MESES_NOMES, MESES_PT, parsePeriodo, agruparPorAnoMes, linksPorBase };
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `node tests/laudos-grouping.test.js`
Expected: imprime as 3 linhas de OK anteriores + `linksPorBase: OK`, sai com código 0.

- [ ] **Step 5: Commit**

```bash
git add js/laudos-grouping.js tests/laudos-grouping.test.js
git commit -m "feat: adiciona linksPorBase para montar links de uma frequência por base"
```

---

## Task 5: `js/laudos-grouping.js` — `inferirBaseFrequencia`

**Files:**
- Modify: `js/laudos-grouping.js`
- Modify: `tests/laudos-grouping.test.js`

**Interfaces:**
- Produces: `LaudosGrouping.inferirBaseFrequencia(titulo: string) -> {base: string|null, frequencia: string|null}`
  - Usado pela Task 7 (botão "Preencher Base/Frequência automaticamente" no admin) para classificar os 34 registros já cadastrados a partir do texto do `titulo`.
  - Padrões reais observados na base (spec, seção "Migração dos dados existentes"): `MENSAL_<BASE>_...`, `DIARIOS_<BASE>_...`, `PLANILHAS DIARIAS-<BASE...>`, `SEMESTRAL_<BASE>_...`, `CERTIFICADO DESINFECÇÃO ...` (sem base/frequência).

- [ ] **Step 1: Escrever o teste que falha**

Adicionar a `tests/laudos-grouping.test.js`:

```js
const { inferirBaseFrequencia } = require('../js/laudos-grouping.js');

assert.deepStrictEqual(inferirBaseFrequencia('MENSAL_POLO_2026_06'), { base: 'Polo', frequencia: 'Mensal' });
assert.deepStrictEqual(inferirBaseFrequencia('DIARIOS_RPR_2026-07'), { base: 'RPR', frequencia: 'Diário' });
assert.deepStrictEqual(inferirBaseFrequencia('PLANILHAS DIARIAS-BELA VISTA'), { base: 'Bela', frequencia: 'Diário' });
assert.deepStrictEqual(inferirBaseFrequencia('PLANILHAS DIARIAS-APRESS'), { base: 'Apress', frequencia: 'Diário' });
assert.deepStrictEqual(inferirBaseFrequencia('SEMESTRAL_APRESS_2026_02'), { base: 'Apress', frequencia: 'Semestral' });
assert.deepStrictEqual(inferirBaseFrequencia('CERTIFICADO DESINFECÇÃO RESERVATÓRIOS'), { base: null, frequencia: null });
assert.deepStrictEqual(inferirBaseFrequencia('CERTIFICADO DESINFECÇÃO CAMINHÕES'), { base: null, frequencia: null });
assert.deepStrictEqual(inferirBaseFrequencia('título qualquer sem padrão'), { base: null, frequencia: null });
assert.deepStrictEqual(inferirBaseFrequencia(''), { base: null, frequencia: null });

console.log('inferirBaseFrequencia: OK');
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `node tests/laudos-grouping.test.js`
Expected: `TypeError: inferirBaseFrequencia is not a function`.

- [ ] **Step 3: Implementar `inferirBaseFrequencia`**

Adicionar antes do `return` final:

```js
  function inferirBaseFrequencia(titulo) {
    const t = String(titulo || '').toUpperCase();

    if (t.indexOf('CERTIFICADO DESINFEC') !== -1) {
      return { base: null, frequencia: null };
    }

    let frequencia = null;
    if (t.indexOf('MENSAL') !== -1) frequencia = 'Mensal';
    else if (t.indexOf('DIARIOS') !== -1 || t.indexOf('DIARIAS') !== -1) frequencia = 'Diário';
    else if (t.indexOf('SEMESTRAL') !== -1) frequencia = 'Semestral';

    let base = null;
    if (t.indexOf('BELA') !== -1) base = 'Bela';
    else if (t.indexOf('POLO') !== -1) base = 'Polo';
    else if (t.indexOf('RPR') !== -1) base = 'RPR';
    else if (t.indexOf('APRESS') !== -1) base = 'Apress';

    return { base, frequencia };
  }
```

Atualizar o `return` final para:

```js
  return { BASES_ORDER, MESES_NOMES, MESES_PT, parsePeriodo, agruparPorAnoMes, linksPorBase, inferirBaseFrequencia };
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `node tests/laudos-grouping.test.js`
Expected: imprime as 4 linhas de OK anteriores + `inferirBaseFrequencia: OK`, sai com código 0.

- [ ] **Step 5: Commit**

```bash
git add js/laudos-grouping.js tests/laudos-grouping.test.js
git commit -m "feat: adiciona inferirBaseFrequencia para classificar laudos existentes pelo título"
```

---

## Task 6: Admin — campos Base/Frequência no formulário e na tabela

**Files:**
- Modify: `admin/dashboard.html:11-12` (adicionar script tag)
- Modify: `admin/dashboard.html:602-624` (thead/tbody da tabela)
- Modify: `admin/dashboard.html:639-657` (formulário do modal)
- Modify: `admin/dashboard.html:701-732` (`renderTable`)
- Modify: `admin/dashboard.html:738-838` (`openModal`, `editLaudo`, `salvarLaudo`)

**Interfaces:**
- Consumes: nenhuma função de `laudos-grouping.js` nesta tarefa (só grava os campos crus escolhidos no formulário).
- Produces: registros no Supabase passam a ter `base` e `frequencia` preenchidos quando cadastrados/editados a partir de agora. Consumido pela Task 8-10 (renderização pública) e pela Task 7 (botão de auto-preenchimento, que só deve tocar registros com esses campos ainda nulos).

- [ ] **Step 1: Incluir o script `laudos-grouping.js`**

Em `admin/dashboard.html`, logo após a linha 12 (`<script src="../js/supabase-config.js"></script>`):

```html
    <script src="../js/laudos-grouping.js"></script>
```

- [ ] **Step 2: Adicionar colunas Base e Frequência na tabela**

Substituir o `<thead>` (linhas 602-609):

```html
                        <thead>
                            <tr>
                                <th>Título</th>
                                <th>Período</th>
                                <th>Tipo</th>
                                <th>Base</th>
                                <th>Frequência</th>
                                <th>Arquivo PDF</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
```

Atualizar o `colspan` da linha de "Carregando laudos..." (linha 613) de `5` para `7`:

```html
                                <td colspan="7" class="empty">
```

- [ ] **Step 3: Adicionar os campos no formulário do modal**

Em `admin/dashboard.html`, depois do bloco `<div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">` que contém Período e Tipo (linhas 639-652) e antes do form-group do Arquivo PDF (linha 653), inserir:

```html
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
                <div class="form-group">
                    <label class="form-label" for="m-base">Base</label>
                    <select id="m-base" class="form-control">
                        <option value="">— (não aplicável)</option>
                        <option value="Bela">Bela</option>
                        <option value="Polo">Polo</option>
                        <option value="RPR">RPR</option>
                        <option value="Apress">Apress</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label" for="m-frequencia">Frequência</label>
                    <select id="m-frequencia" class="form-control">
                        <option value="">— (não aplicável)</option>
                        <option value="Diário">Diário</option>
                        <option value="Mensal">Mensal</option>
                        <option value="Semestral">Semestral</option>
                    </select>
                </div>
            </div>
```

- [ ] **Step 4: Exibir Base/Frequência na tabela (`renderTable`)**

Em `admin/dashboard.html`, na função `renderTable` (linha 701), atualizar o `colspan` da linha vazia (linha 710) de `5` para `7`, e o template de cada linha (linhas 716-731) para incluir as duas colunas novas:

```js
            tbody.innerHTML = laudos.map(l => `
        <tr>
          <td style="font-weight:600;">${escapeHtml(l.titulo)}</td>
          <td>${escapeHtml(l.periodo)}</td>
          <td><span class="badge badge-brand">${escapeHtml(l.tipo)}</span></td>
          <td>${escapeHtml(l.base) || '—'}</td>
          <td>${escapeHtml(l.frequencia) || '—'}</td>
          <td style="font-family:monospace; font-size:.8rem;">
            <a href="${l.arquivo_url}" target="_blank" rel="noopener" style="color:#0284c7;">Ver PDF ↗</a>
          </td>
          <td>
            <div style="display:flex; gap:.4rem;">
              <button class="btn btn-ghost btn-sm" onclick="editLaudo('${l.id}')">Editar</button>
              <button class="btn btn-danger btn-sm" onclick="deleteLaudo('${l.id}')">Excluir</button>
            </div>
          </td>
        </tr>
      `).join('');
```

- [ ] **Step 5: Resetar/preencher os campos em `openModal` e `editLaudo`**

Em `openModal` (linha 738), dentro do bloco `if (!editing)` (depois da linha `document.getElementById('m-tipo').value = 'Desinfecção';`), adicionar:

```js
                document.getElementById('m-base').value = '';
                document.getElementById('m-frequencia').value = '';
```

Em `editLaudo` (linha 758), depois de `document.getElementById('m-tipo').value = l.tipo;`, adicionar:

```js
            document.getElementById('m-base').value = l.base || '';
            document.getElementById('m-frequencia').value = l.frequencia || '';
```

- [ ] **Step 6: Persistir os campos em `salvarLaudo`**

Em `salvarLaudo` (linha 777), depois da linha `const tipo = document.getElementById('m-tipo').value;`, adicionar:

```js
            const base = document.getElementById('m-base').value || null;
            const frequencia = document.getElementById('m-frequencia').value || null;
```

Trocar o bloco de update (linha 812) de:

```js
                    const updateData = { titulo, periodo, tipo };
```

para:

```js
                    const updateData = { titulo, periodo, tipo, base, frequencia };
```

E trocar o bloco de insert (linhas 824-826) de:

```js
                    const { error } = await sb.from(TABLE).insert({
                        titulo, periodo, tipo, arquivo_url, arquivo_path
                    });
```

para:

```js
                    const { error } = await sb.from(TABLE).insert({
                        titulo, periodo, tipo, base, frequencia, arquivo_url, arquivo_path
                    });
```

- [ ] **Step 7: Verificação manual**

Este arquivo não tem cobertura de teste automatizado (é HTML+JS embutido, sem DOM headless configurado no projeto). Verificar manualmente:

```bash
grep -n "m-base\|m-frequencia" admin/dashboard.html
```

Expected: aparecem as referências em `openModal`, `editLaudo`, `salvarLaudo` e no HTML do modal (pelo menos 6 ocorrências). Login real no admin (`admin/index.html`) é necessário para um teste de ponta a ponta — isso requer as credenciais reais do Supabase Auth do cliente, fora do alcance deste ambiente. Recomendar ao cliente testar o cadastro de um laudo novo após o deploy.

- [ ] **Step 8: Commit**

```bash
git add admin/dashboard.html
git commit -m "feat: adiciona campos Base e Frequência ao formulário e tabela do admin"
```

---

## Task 7: Admin — botão "Preencher Base/Frequência automaticamente"

**Files:**
- Modify: `admin/dashboard.html:596-599` (table-header, adicionar botão)
- Modify: `admin/dashboard.html` (novo bloco de função JS, próximo a `loadLaudos`)

**Interfaces:**
- Consumes: `LaudosGrouping.inferirBaseFrequencia` (Task 5).
- Produces: função global `autoPreencherBaseFrequencia()` chamada pelo botão; atualiza em lote os registros do Supabase que ainda não têm `base`/`frequencia` preenchidos.

- [ ] **Step 1: Adicionar o botão no cabeçalho da tabela**

Em `admin/dashboard.html`, dentro de `.table-header` (linhas 596-599), depois do `<h2>Lista de Laudos</h2>`:

```html
                <div class="table-header">
                    <h2>Lista de Laudos</h2>
                    <div style="display:flex; align-items:center; gap:.75rem;">
                        <button class="btn btn-ghost btn-sm" onclick="autoPreencherBaseFrequencia()">
                            Preencher Base/Frequência automaticamente
                        </button>
                        <span class="badge badge-brand" id="table-count">—</span>
                    </div>
                </div>
```

(Isso substitui o `<div class="table-header">...</div>` original de duas linhas — o `<span id="table-count">` só muda de lugar, dentro do novo `<div>` flex.)

- [ ] **Step 2: Implementar `autoPreencherBaseFrequencia`**

Adicionar a função em `admin/dashboard.html`, logo depois da função `loadLaudos` (depois da linha 699, `}` de fechamento):

```js
        async function autoPreencherBaseFrequencia() {
            const candidatos = laudos.filter(l => !l.base && !l.frequencia);
            if (!candidatos.length) {
                alert('Nenhum laudo pendente de classificação — todos já têm Base/Frequência definidos (ou corretamente em branco).');
                return;
            }

            const atualizaveis = candidatos
                .map(l => ({ laudo: l, inferido: LaudosGrouping.inferirBaseFrequencia(l.titulo) }))
                .filter(({ inferido }) => inferido.base || inferido.frequencia);

            if (!atualizaveis.length) {
                alert('Nenhum dos ' + candidatos.length + ' laudo(s) pendente(s) tem um padrão de título reconhecível. Classifique manualmente pelo botão "Editar".');
                return;
            }

            if (!confirm('Classificar automaticamente ' + atualizaveis.length + ' laudo(s) com base no título? Você pode revisar e corrigir depois pelo botão "Editar".')) {
                return;
            }

            let sucesso = 0;
            let falhas = 0;
            for (const { laudo, inferido } of atualizaveis) {
                const { error } = await sb.from(TABLE)
                    .update({ base: inferido.base, frequencia: inferido.frequencia })
                    .eq('id', laudo.id);
                if (error) falhas++; else sucesso++;
            }

            alert(sucesso + ' laudo(s) classificado(s) com sucesso.' + (falhas ? ' ' + falhas + ' falharam.' : ''));
            await loadLaudos();
        }
```

- [ ] **Step 3: Verificação manual**

```bash
grep -n "autoPreencherBaseFrequencia" admin/dashboard.html
```

Expected: 2 ocorrências (definição da função + `onclick` do botão).

Teste funcional requer login real no admin (fora do alcance deste ambiente, ver Task 6 Step 7). Documentar para o cliente: depois do deploy, rodar o SQL da Task 1, abrir o admin, clicar em "Preencher Base/Frequência automaticamente" uma vez, revisar a tabela resultante.

- [ ] **Step 4: Commit**

```bash
git add admin/dashboard.html
git commit -m "feat: adiciona classificação automática de Base/Frequência a partir do título"
```

---

## Task 8: `laudos.html` — abas de categoria e lista simples (Desinfecção)

**Files:**
- Modify: `laudos.html:40-41` (adicionar script tag)
- Modify: `laudos.html:249-254` (remover botão "Todos", ajustar `active` padrão)
- Modify: `laudos.html:266-349` (lógica de render)

**Interfaces:**
- Consumes: nenhuma função de `laudos-grouping.js` ainda (Desinfecção usa lista simples, sem agrupamento).
- Produces: variável `currentTab` (substitui `currentFilter`) e função `render()` (substitui `renderLaudosFiltrados`) que despacha por categoria — as Tasks 9 e 10 vão estender o `if/else` desta função para as outras duas categorias.

- [ ] **Step 1: Incluir o script `laudos-grouping.js`**

Em `laudos.html`, logo após a linha 41 (`<script src="js/supabase-config.js"></script>`):

```html
    <script src="js/laudos-grouping.js"></script>
```

- [ ] **Step 2: Remover a aba "Todos" e ajustar a aba ativa padrão**

Substituir o bloco de filtros (linhas 249-254):

```html
                <div class="laudos-filters" id="laudos-filters">
                    <button type="button" class="laudo-filter-btn active" data-filter="Desinfecção">Desinfecção</button>
                    <button type="button" class="laudo-filter-btn" data-filter="Fisico químicos/orgabolépticos">Fisico químicos/orgabolépticos</button>
                    <button type="button" class="laudo-filter-btn" data-filter="Portaria GM/MS n 888">Portaria GM/MS n 888</button>
                </div>
```

- [ ] **Step 3: Reescrever a lógica de renderização**

Substituir todo o `<script>` final (linhas 266-349) por:

```html
    <script>
        const sb = window.supabase.createClient(
            window.AGUAJATO_SUPABASE.url,
            window.AGUAJATO_SUPABASE.anonKey
        );

        window.allLaudos = [];
        let currentTab = 'Desinfecção';

        function escapeHtml(s) {
            return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        }

        function emptyStateHtml(mensagem) {
            return `<div class="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <p>${mensagem}</p>
        </div>`;
        }

        function renderListaSimples(lista) {
            return `<div class="laudos-grid">` + lista.map(l => `
          <div class="laudo-card">
            <div class="laudo-icon" style="background:var(--brand-light);color:var(--brand);">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            </div>
            <div class="laudo-info">
              <div class="laudo-title">${escapeHtml(l.titulo)}</div>
              <div class="laudo-meta">📅 ${escapeHtml(l.periodo)} · ${escapeHtml(l.tipo)}</div>
            </div>
            <div class="laudo-actions">
              <a href="${l.arquivo_url}" target="_blank" rel="noopener" class="btn btn-primary btn-sm">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                Baixar
              </a>
            </div>
          </div>
        `).join('') + `</div>`;
        }

        function render() {
            const container = document.getElementById('laudos-list');
            const counter = document.getElementById('laudo-count');
            const lista = window.allLaudos.filter(l => l.tipo === currentTab);

            counter.textContent = lista.length + ' laudo' + (lista.length !== 1 ? 's' : '') + ' disponível' + (lista.length !== 1 ? 'is' : '');

            if (!lista.length) {
                container.innerHTML = emptyStateHtml('Nenhum laudo desta categoria.');
                return;
            }

            if (currentTab === 'Desinfecção') {
                container.innerHTML = renderListaSimples(lista);
            } else {
                container.innerHTML = emptyStateHtml('Categoria em construção.');
            }
        }

        async function loadLaudos() {
            const container = document.getElementById('laudos-list');
            const counter = document.getElementById('laudo-count');
            const { data, error } = await sb
                .from(window.AGUAJATO_SUPABASE.table)
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                counter.textContent = 'Erro ao carregar';
                counter.style.background = 'var(--red-light)';
                counter.style.color = 'var(--red)';
                container.innerHTML = `<div class="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          <p>Não foi possível carregar os laudos. Tente novamente.</p>
        </div>`;
                return;
            }

            window.allLaudos = data || [];
            render();
        }

        document.addEventListener('DOMContentLoaded', () => {
            document.getElementById('laudos-filters').addEventListener('click', e => {
                const btn = e.target.closest('.laudo-filter-btn');
                if (!btn) return;
                document.querySelectorAll('.laudo-filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentTab = btn.dataset.filter;
                render();
            });
            loadLaudos();
        });
    </script>
```

- [ ] **Step 4: Verificação manual (servidor local + browser)**

```bash
python3 -m http.server 8000
```

Abrir `http://localhost:8000/laudos.html` no browser. Esperado: aba "Desinfecção" ativa por padrão, mostrando os 2 certificados reais como cards (mesmo visual de antes). Trocar para as outras duas abas deve mostrar "Categoria em construção." (será substituído nas Tasks 9 e 10). Parar o servidor com Ctrl+C ao terminar.

- [ ] **Step 5: Commit**

```bash
git add laudos.html
git commit -m "feat: reestrutura abas de laudos.html sem aba Todos, Desinfecção com lista simples"
```

---

## Task 9: `laudos.html` — tabela de Físico Químicos/Organolépticos (Diário + Mensal)

**Files:**
- Modify: `laudos.html` (bloco `<style>`, linhas 42-156)
- Modify: `laudos.html` (função `render`, dentro do `<script>` criado na Task 8)

**Interfaces:**
- Consumes: `LaudosGrouping.agruparPorAnoMes`, `LaudosGrouping.linksPorBase` (Tasks 3 e 4).
- Produces: função `renderTabelaAnoMes(lista, colunas)` reaproveitada pela Task 10 (`colunas` é um array de `{titulo, frequencia}` — 2 itens aqui, 1 na Task 10).

- [ ] **Step 1: Adicionar CSS da tabela agrupada**

Em `laudos.html`, dentro do bloco `<style>`, logo antes do fechamento `</style>` (linha 156), adicionar:

```css
        .laudos-ano {
            margin-bottom: 2rem;
        }

        .laudos-ano-titulo {
            font-size: 0.95rem;
            font-weight: 800;
            color: var(--slate-900);
            background: var(--brand-light);
            padding: 0.5rem 1rem;
            border-radius: var(--radius-sm);
            margin-bottom: 0.75rem;
        }

        .laudos-tabela {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.85rem;
        }

        .laudos-tabela th {
            text-align: left;
            font-size: 0.75rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--slate-500);
            padding: 0.6rem 0.75rem;
            border-bottom: 2px solid var(--slate-200);
        }

        .laudos-tabela td {
            padding: 0.65rem 0.75rem;
            border-bottom: 1px solid var(--slate-100);
            color: var(--slate-700);
            vertical-align: top;
        }

        .laudos-tabela td.mes-nome {
            font-weight: 700;
            color: var(--slate-900);
            white-space: nowrap;
        }

        .laudos-tabela a {
            color: var(--brand);
            font-weight: 600;
            text-decoration: none;
        }

        .laudos-tabela a:hover {
            text-decoration: underline;
        }

        .laudos-tabela .sem-links {
            color: var(--slate-400);
        }
```

- [ ] **Step 2: Implementar `renderTabelaAnoMes` e ligar à aba Físico-Químicos**

No `<script>` de `laudos.html` (criado na Task 8), adicionar a função `renderTabelaAnoMes` logo depois de `renderListaSimples`:

```js
        function anchorsHtml(items) {
            if (!items.length) return '<span class="sem-links">—</span>';
            return items.map(i => `<a href="${escapeHtml(i.arquivo_url)}" target="_blank" rel="noopener">${escapeHtml(i.base)}</a>`).join(' | ');
        }

        function renderTabelaAnoMes(lista, colunas) {
            const anos = LaudosGrouping.agruparPorAnoMes(lista);
            return anos.map(grupoAno => {
                const linhas = grupoAno.meses.map(grupoMes => {
                    const celulas = colunas.map(col => {
                        const links = LaudosGrouping.linksPorBase(grupoMes.laudos, col.frequencia);
                        return `<td>${anchorsHtml(links)}</td>`;
                    }).join('');
                    const rotuloMes = grupoMes.mes ? `${grupoMes.mesNome}/${grupoAno.ano}` : grupoMes.mesNome;
                    return `<tr><td class="mes-nome">${escapeHtml(rotuloMes)}</td>${celulas}</tr>`;
                }).join('');

                const cabecalho = `<tr><th>Mês</th>${colunas.map(c => `<th>${escapeHtml(c.titulo)}</th>`).join('')}</tr>`;
                const tituloAno = grupoAno.ano ? `Período ${grupoAno.ano}` : 'Outros períodos';

                return `<div class="laudos-ano">
            <div class="laudos-ano-titulo">${escapeHtml(tituloAno)}</div>
            <table class="laudos-tabela"><thead>${cabecalho}</thead><tbody>${linhas}</tbody></table>
          </div>`;
            }).join('');
        }
```

Atualizar a função `render()` (da Task 8), trocando o `else` genérico por um `else if` específico para Físico-Químicos:

```js
            if (currentTab === 'Desinfecção') {
                container.innerHTML = renderListaSimples(lista);
            } else if (currentTab === 'Fisico químicos/orgabolépticos') {
                container.innerHTML = renderTabelaAnoMes(lista, [
                    { titulo: 'Laudos Diário (por base)', frequencia: 'Diário' },
                    { titulo: 'Laudos Mensais (por base)', frequencia: 'Mensal' }
                ]);
            } else {
                container.innerHTML = emptyStateHtml('Categoria em construção.');
            }
```

- [ ] **Step 3: Verificação manual (servidor local + browser, dados reais)**

```bash
python3 -m http.server 8000
```

Abrir `http://localhost:8000/laudos.html`, clicar na aba "Fisico químicos/orgabolépticos". Como os registros reais ainda não têm `base`/`frequencia` preenchidos (Task 6/7 ainda não rodaram em produção), esperado: a tabela aparece agrupada por ano/mês corretamente (usando o `periodo` real), mas todas as células mostram "—" (sem links) — o que é o comportamento correto até o SQL da Task 1 rodar e os laudos serem classificados pela Task 7. Confirmar que não há erro no console do browser e que os cabeçalhos "Período 2026" / meses aparecem na ordem certa (mais recente primeiro). Parar o servidor com Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add laudos.html
git commit -m "feat: tabela agrupada por ano/mês para Fisico químicos/orgabolépticos"
```

---

## Task 10: `laudos.html` — tabela de Portaria GM/MS n 888 (Semestral)

**Files:**
- Modify: `laudos.html` (função `render`)

**Interfaces:**
- Consumes: `renderTabelaAnoMes` (Task 9), reaproveitada com um único item em `colunas`.

- [ ] **Step 1: Ligar a aba Portaria à `renderTabelaAnoMes`**

Atualizar a função `render()`:

```js
            if (currentTab === 'Desinfecção') {
                container.innerHTML = renderListaSimples(lista);
            } else if (currentTab === 'Fisico químicos/orgabolépticos') {
                container.innerHTML = renderTabelaAnoMes(lista, [
                    { titulo: 'Laudos Diário (por base)', frequencia: 'Diário' },
                    { titulo: 'Laudos Mensais (por base)', frequencia: 'Mensal' }
                ]);
            } else if (currentTab === 'Portaria GM/MS n 888') {
                container.innerHTML = renderTabelaAnoMes(lista, [
                    { titulo: 'Links dos Laudos Semestral (por base)', frequencia: 'Semestral' }
                ]);
            }
```

(O `else` genérico deixa de existir — as 3 categorias reais agora têm um branch específico.)

- [ ] **Step 2: Verificação manual (servidor local + browser, dados reais)**

```bash
python3 -m http.server 8000
```

Abrir `http://localhost:8000/laudos.html`, clicar em cada uma das 3 abas. Esperado:
- Desinfecção: 2 cards (Reservatórios, Caminhões).
- Fisico químicos/orgabolépticos: tabela agrupada por ano/mês, 2 colunas.
- Portaria GM/MS n 888: tabela agrupada por ano/mês, 1 coluna com título "Links dos Laudos Semestral (por base)".

Sem erros no console. Parar o servidor com Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add laudos.html
git commit -m "feat: tabela agrupada por ano/mês para Portaria GM/MS n 888"
```

---

## Task 11: Verificação final ponta a ponta

**Files:**
- Nenhum arquivo novo — só verificação.

- [ ] **Step 1: Rodar a suíte completa de testes puros**

```bash
node tests/laudos-grouping.test.js
```

Expected: as 5 linhas de OK (`parsePeriodo`, `agruparPorAnoMes`, `linksPorBase`, `inferirBaseFrequencia` e mais uma, se houver) impressas, saída com código 0.

- [ ] **Step 2: Checar que não sobrou referência a `renderLaudosFiltrados` ou `currentFilter` (nomes antigos)**

```bash
grep -n "renderLaudosFiltrados\|currentFilter" laudos.html
```

Expected: nenhuma ocorrência (foram renomeados para `render`/`currentTab` na Task 8).

- [ ] **Step 3: Revisão visual final no browser com dados reais**

```bash
python3 -m http.server 8000
```

Abrir `http://localhost:8000/laudos.html`, percorrer as 3 abas, comparar visualmente com `referencia/Print enviada anteriormente.jpeg` (Físico-Químicos) e `referencia/image001.png` (Portaria). Tirar um screenshot de cada aba para registro. Parar o servidor com Ctrl+C.

- [ ] **Step 4: Lembrete final para o cliente (não é código)**

Confirmar por escrito ao cliente, ao final da implementação:
1. Rodar o SQL de `sql/2026-08-30-add-base-frequencia.sql` no painel do Supabase.
2. Abrir `/admin/dashboard.html`, clicar em "Preencher Base/Frequência automaticamente" uma vez.
3. Revisar manualmente os poucos laudos que não tiverem sido classificados automaticamente (ex: títulos fora do padrão).

---

## Self-Review

**Spec coverage:**
- Item 1 (schema base/frequencia) → Task 1, 6.
- Item 2 (ordem das bases) → Task 2 (`BASES_ORDER`), usado nas Tasks 4, 9, 10.
- Item 3 (frequências) → Tasks 5, 6 (selects), 9, 10.
- Item 4 (sem aba Todos, default Desinfecção) → Task 8.
- Item 5 (base ausente omitida) → Task 4 (`linksPorBase` só retorna bases presentes).
- Item 6 (agrupar por ano desc/mês desc) → Task 3.
- Item 7 (periodo como fonte de verdade, grupo "Outros") → Tasks 2, 3.
- Layout Desinfecção (lista simples) → Task 8.
- Layout Físico-Químicos (2 colunas) → Task 9.
- Layout Portaria (1 coluna) → Task 10.
- Migração/auto-preenchimento → Task 5, 7.
- "Fora de escopo" (campo `resultado`, cabeçalho/rodapé) → nenhuma task toca nesses pontos; confirmado por omissão.
- Pré-requisito SQL manual → Task 1 + lembrete na Task 11.

Nenhuma lacuna encontrada.

**Placeholder scan:** nenhum "TBD"/"implementar depois" — todos os steps têm código completo.

**Type consistency:** `agruparPorAnoMes` retorna `{ano, meses: [{mes, mesNome, laudos}]}` — usado de forma consistente nas Tasks 3, 9 e 10 (`grupoAno.ano`, `grupoAno.meses`, `grupoMes.mes`, `grupoMes.mesNome`, `grupoMes.laudos`). `linksPorBase` retorna `{base, arquivo_url, titulo}` — usado de forma consistente em `anchorsHtml` (Task 9). Nomes de função (`render`, `currentTab`, `renderListaSimples`, `renderTabelaAnoMes`, `anchorsHtml`, `emptyStateHtml`) usados de forma consistente entre Tasks 8, 9 e 10.
