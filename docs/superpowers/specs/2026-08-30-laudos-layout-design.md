# Restauração do layout antigo de Laudos

**Data:** 2026-08-30
**Status:** Aprovado pelo cliente (via perguntas interativas)

## Contexto

O cliente pediu para a página `/laudos` voltar a exibir os laudos como no site
antigo: separados por categoria, com os meses agrupados em uma linha só (em
vez da lista de cards individuais que existe hoje).

Referências usadas (pasta `referencia/`):
- `Como está hoje.jpeg` — layout atual (cards + filtro por categoria).
- `Print enviada anteriormente.jpeg` — layout antigo desejado para a
  categoria Físico-Químicos: tabela agrupada por "Período" (ano), uma linha
  por mês, colunas "Laudos Diário (por base)" e "Laudos Mensais (por base)",
  cada célula com os links das bases unidos por `|`.
- `image001.png` — layout antigo da categoria Portaria GM/MS n 888: tabela
  de uma coluna só ("Links dos Laudos por base"), sem divisão Diário/Mensal.
- `reslaudossiteaguajatoreorganizao/{laudos,desinfeccao,fisico,portaria}.html`
  — HTMLs antigos (Adobe Muse) confirmando que o site antigo tinha 3 páginas
  separadas por categoria (Desinfecção, Físico-Químicos, Portaria), sem aba
  "Todos".

### Dados reais (Supabase, tabela `aguajato_laudos`)

Consulta feita via REST API confirmou os 34 registros atuais e revelou que
**cada categoria tem um formato de dado diferente** — a suposição inicial de
uma tabela única "Diário | Mensal" para tudo estava errada:

| Categoria (`tipo`) | Padrão de `titulo` observado | Frequência | Por base? |
|---|---|---|---|
| `Fisico químicos/orgabolépticos` | `MENSAL_<BASE>_<ano>_<mes>`, `DIARIOS_<BASE>_<ano>-<mes>`, `PLANILHAS DIARIAS-<BASE>` | Diário e Mensal (duas por mês) | Sim |
| `Portaria GM/MS n 888` | `SEMESTRAL_<BASE>_<ano>_<mes>` | Só Semestral | Sim |
| `Desinfecção` | `CERTIFICADO DESINFECÇÃO RESERVATÓRIOS`, `CERTIFICADO DESINFECÇÃO CAMINHÕES` | N/A | Não (certificado geral da empresa) |

Colunas atuais da tabela: `id, titulo, periodo, tipo, resultado, arquivo_url,
arquivo_path, created_at`. Não existem colunas para "base" nem "frequência"
— essa informação hoje só está embutida no texto livre do `titulo`.

O campo `resultado` (ex: `"✔ Aprovado"`) existe mas não é usado em nenhuma
tela hoje e **fica fora do escopo** desta mudança.

## Decisões (confirmadas com o cliente)

1. **Schema**: adicionar duas colunas novas em `aguajato_laudos`:
   `base` (text, nullable) e `frequencia` (text, nullable). O admin passa a
   ter selects para preencher esses dois campos ao cadastrar/editar um
   laudo. Motivo: parsing por regex do `titulo` livre é frágil — se alguém
   digitar fora do padrão, o laudo não seria agrupado corretamente.
2. **Bases fixas** (nesta ordem, igual ao print antigo): `Bela`, `Polo`,
   `RPR`, `Apress`.
3. **Frequências possíveis**: `Diário`, `Mensal`, `Semestral` (mais `—` /
   vazio para itens sem base/frequência, como os certificados de
   Desinfecção).
4. **Sem aba "Todos"** — a página tem só as 3 abas de categoria
   (Desinfecção, Físico Químicos/Organolépticos, Portaria GM/MS n 888),
   igual ao site antigo. Cada aba usa o formato de tabela apropriado à sua
   categoria (não existe um formato único que sirva para as três). A aba
   ativa por padrão ao carregar a página é **Desinfecção** (primeira na
   ordem, igual à navegação do site antigo).
5. **Bases ausentes**: se uma base não tem laudo cadastrado para
   aquele mês/frequência, ela é simplesmente omitida da linha (não aparece
   nem como texto cinza).
6. **Agrupamento por ano**: dentro de cada categoria, os laudos são
   agrupados por ano (`Período 2026`, `Período 2025`, ...), do mais recente
   para o mais antigo; dentro do ano, uma linha por mês, também do mais
   recente para o mais antigo.
7. **Fonte de verdade para o mês/ano**: o campo `periodo` (texto livre tipo
   `"junho/2026"` ou `"MAIO/2026"`), não o `titulo` — já existem
   inconsistências entre o mês sugerido no título e o `periodo` digitado
   (ex: `SEMESTRAL_RPR_2026_04` tem `periodo: "MARÇO/2026"`). O parsing
   precisa ser case-insensitive e tolerar nomes de mês por extenso em
   português. Se um `periodo` não puder ser interpretado (formato
   inesperado), o laudo cai num grupo `"Outros"` no final da lista daquela
   categoria, em vez de quebrar a página ou desaparecer.

## Layout por categoria

### Desinfecção
Lista simples (não é organizada por base): uma linha por laudo com título,
período e link para o PDF, ordenada do mais recente para o mais antigo.
Reaproveita o estilo de linha/lista já usado hoje (sem grid de cards).

### Físico Químicos/Organolépticos
Tabela agrupada por ano → mês. Cada linha de mês tem duas colunas:

- **Laudos Diário (por base)** — links das bases com `frequencia = Diário`
  naquele mês, unidos com ` | `.
- **Laudos Mensais (por base)** — links das bases com `frequencia = Mensal`
  naquele mês, unidos com ` | `.

### Portaria GM/MS n 888
Tabela agrupada por ano → mês, com uma única coluna **Links dos Laudos
Semestral (por base)** — links das bases com `frequencia = Semestral`
naquele mês, unidos com ` | `.

## Migração dos dados existentes

Os 34 registros atuais seguem padrões de `titulo` bem definidos o
suficiente para inferir `base` e `frequencia` automaticamente (ex:
`MENSAL_POLO_2026_06` → base=Polo, frequencia=Mensal). Em vez de pedir para
o cliente reclassificar cada laudo manualmente, o painel admin ganha um
botão único **"Preencher Base/Frequência automaticamente"** que roda esse
reconhecimento de padrão nos registros que ainda não têm `base`/`frequencia`
preenchidos e atualiza em lote (usando a sessão autenticada do admin, já que
a anon key sozinha não tem permissão de update). O cliente pode revisar e
corrigir manualmente pela tabela do admin depois.

Padrões reconhecidos pela auto-preencher:
- `MENSAL_<BASE>_...` → Mensal
- `DIARIOS_<BASE>_...` / `PLANILHAS DIARIAS-<BASE...>` → Diário
- `SEMESTRAL_<BASE>_...` → Semestral
- `CERTIFICADO DESINFECÇÃO ...` → sem base/frequência (fica em branco,
  correto para a categoria Desinfecção)
- Nomes de base reconhecidos por substring case-insensitive: `bela`, `polo`,
  `rpr`, `apress`.

## Fora de escopo

- Exibir o campo `resultado` ("✔ Aprovado") em qualquer tela.
- Mudar o cabeçalho, selos de confiança ou rodapé da página `/laudos`.
- Qualquer alteração de estilo visual/cores fora da seção "Laudos
  Disponíveis".

## Pré-requisito manual (fora do controle do código)

Como não há acesso de service-role/CLI do Supabase neste ambiente, o
cliente (ou quem tiver acesso ao painel do Supabase) precisa rodar este SQL
uma vez, antes do deploy da mudança de admin/site:

```sql
alter table aguajato_laudos
  add column if not exists base text,
  add column if not exists frequencia text;
```
