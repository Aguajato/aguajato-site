// Como rodar: node tests/laudos-grouping.test.js (sem framework, sem npm install — este repo não tem build tooling por design)
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

// agruparPorAnoMes
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

// linksPorBase
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

// inferirBaseFrequencia
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
