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

  function linksPorBase(laudos, frequencia) {
    return BASES_ORDER
      .map(base => laudos.find(l => l.frequencia === frequencia && l.base === base))
      .filter(Boolean)
      .map(l => ({ base: l.base, arquivo_url: l.arquivo_url, titulo: l.titulo }));
  }

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

  return { BASES_ORDER, MESES_NOMES, MESES_PT, parsePeriodo, agruparPorAnoMes, linksPorBase, inferirBaseFrequencia };
});
