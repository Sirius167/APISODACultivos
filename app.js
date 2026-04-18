

// ── CONFIG ──────────────────────────────────────────────────
const APP_TOKEN = 'zx7odryLe9M4i3jda4o4P5LjL';
const API_URL   = 'https://www.datos.gov.co/resource/2pnw-mmge.json';
const PAGE_SIZE = 50;

// ── ESTADO ──────────────────────────────────────────────────
let allData    = [];   
let filtered   = [];  
let currentPage = 1;

// ── DOM ──────────────────────────────────────────────────────
const searchInput   = document.getElementById('searchInput');
const clearBtn      = document.getElementById('clearBtn');
const deptoFilter   = document.getElementById('deptoFilter');
const grupoFilter   = document.getElementById('grupoFilter');
const cultivoFilter = document.getElementById('cultivoFilter');
const anioFilter    = document.getElementById('anioFilter');
const cicloFilter   = document.getElementById('cicloFilter');
const sortSelect    = document.getElementById('sortSelect');
const tableBody     = document.getElementById('tableBody');
const resultsCount  = document.getElementById('resultsCount');
const pageInfo      = document.getElementById('pageInfo');
const prevBtn       = document.getElementById('prevBtn');
const nextBtn       = document.getElementById('nextBtn');

// ── COLORES PARA GRÁFICAS ────────────────────────────────────
const PALETTE = [
  '#2D6A4F','#D4A017','#1A6CA8','#7B4F2E',
  '#5A6E2C','#8E4585','#B03A2E','#1A7A7A',
  '#4A4E8C','#C56A14','#2E7D32','#00838F'
];

// ── FETCH ────────────────────────────────────────────────────
async function fetchData() {
  try {
    const params = new URLSearchParams({
      '$limit': 1000,
      '$order': 'a_o DESC'
    });
    const res = await fetch(`${API_URL}?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    allData = await res.json();
    init();
  } catch (err) {
    console.error('Error al consultar la API:', err);
    tableBody.innerHTML = `
      <tr><td colspan="14" class="loading-cell">
        ⚠️ No se pudo conectar con la API SODA.<br>
        <small>Verifica tu conexión o intenta más tarde.</small>
      </td></tr>`;
    resultsCount.textContent = 'Error al cargar datos';
  }
}

// ── INICIALIZAR ──────────────────────────────────────────────
function init() {
  populateFilters();
  applyAndRender();
}

// ── POBLAR SELECTS ───────────────────────────────────────────
function populateFilters() {
  const unique = (field) => [...new Set(allData.map(r => r[field]).filter(Boolean))].sort();

  fillSelect(deptoFilter,   unique('departamento'));
  fillSelect(grupoFilter,   unique('grupo_de_cultivo'));
  fillSelect(cultivoFilter, unique('cultivo'));
  fillSelect(anioFilter,    unique('a_o'));
  fillSelect(cicloFilter,   unique('ciclo_de_cultivo'));
}

function fillSelect(el, values) {
  values.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    el.appendChild(opt);
  });
}

// ── FILTRAR Y ORDENAR ────────────────────────────────────────
function applyAndRender() {
  const q      = searchInput.value.trim().toLowerCase();
  const depto  = deptoFilter.value;
  const grupo  = grupoFilter.value;
  const cultivo = cultivoFilter.value;
  const anio   = anioFilter.value;
  const ciclo  = cicloFilter.value;
  const sort   = sortSelect.value;

  filtered = allData.filter(r => {
    if (depto   && r.departamento     !== depto)   return false;
    if (grupo   && r.grupo_de_cultivo !== grupo)   return false;
    if (cultivo && r.cultivo          !== cultivo) return false;
    if (anio    && r.a_o              !== anio)    return false;
    if (ciclo   && r.ciclo_de_cultivo !== ciclo)   return false;
    if (q) {
      const hay = [r.cultivo, r.municipio, r.departamento,
                   r.subgrupo_de_cultivo, r.nombre_cientifico]
        .filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // Ordenar
  filtered.sort((a, b) => {
    switch (sort) {
      case 'cultivo':          return (a.cultivo||'').localeCompare(b.cultivo||'');
      case 'rendimiento-desc': return num(b,'rendimiento_t_ha') - num(a,'rendimiento_t_ha');
      case 'rendimiento-asc':  return num(a,'rendimiento_t_ha') - num(b,'rendimiento_t_ha');
      case 'produccion-desc':  return num(b,'producci_n_t')     - num(a,'producci_n_t');
      case 'area-desc':        return num(b,'rea_sembrada_ha')  - num(a,'rea_sembrada_ha');
      case 'anio-desc':        return (b.a_o||'').localeCompare(a.a_o||'');
      case 'anio-asc':         return (a.a_o||'').localeCompare(b.a_o||'');
      default: return 0;
    }
  });

  currentPage = 1;
  updateKPIs();
  updateChips();
  updateCharts();
  renderTable();
  updatePager();
}

const num = (r, f) => parseFloat(r[f]) || 0;

// ── KPIs del header ──────────────────────────────────────────
function updateKPIs() {
  const deptos   = new Set(allData.map(r => r.departamento).filter(Boolean));
  const cultivos = new Set(allData.map(r => r.cultivo).filter(Boolean));
  const anios    = new Set(allData.map(r => r.a_o).filter(Boolean));

  animCount('kpiRegistros', allData.length);
  animCount('kpiCultivos',  cultivos.size);
  animCount('kpiDeptos',    deptos.size);
  animCount('kpiAnios',     anios.size);
}

function animCount(id, target) {
  const el = document.getElementById(id);
  const duration = 800;
  const start = performance.now();
  const from = 0;
  function step(now) {
    const p = Math.min((now - start) / duration, 1);
    el.textContent = Math.round(from + (target - from) * easeOut(p));
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
const easeOut = t => 1 - Math.pow(1 - t, 3);

// ── STAT CHIPS ───────────────────────────────────────────────
function updateChips() {
  const src = filtered.length ? filtered : allData;

  let totalProd = 0, totalArea = 0, totalRend = 0, rendCount = 0;
  const prodPorCultivo = {};
  const prodPorDepto   = {};

  src.forEach(r => {
    const p = num(r, 'producci_n_t');
    const a = num(r, 'rea_sembrada_ha');
    const rd = num(r, 'rendimiento_t_ha');
    totalProd += p;
    totalArea += a;
    if (rd > 0) { totalRend += rd; rendCount++; }
    if (r.cultivo)       prodPorCultivo[r.cultivo]       = (prodPorCultivo[r.cultivo] || 0) + p;
    if (r.departamento)  prodPorDepto[r.departamento]    = (prodPorDepto[r.departamento] || 0) + p;
  });

  const topCultivo = topKey(prodPorCultivo);
  const topDepto   = topKey(prodPorDepto);
  const avgRend    = rendCount ? (totalRend / rendCount).toFixed(2) : '—';

  setText('sProd',       fmt(totalProd) + ' t');
  setText('sArea',       fmt(totalArea) + ' ha');
  setText('sRend',       avgRend + ' t/ha');
  setText('sTopCultivo', topCultivo || '—');
  setText('sTopDepto',   topDepto   || '—');

  // Update results count
  resultsCount.textContent =
    `${filtered.length.toLocaleString('es-CO')} registro${filtered.length !== 1 ? 's' : ''} encontrado${filtered.length !== 1 ? 's' : ''}`;
}

const topKey = obj => Object.entries(obj).sort((a,b) => b[1]-a[1])[0]?.[0];
const fmt    = n  => n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e3 ? (n/1e3).toFixed(1)+'K' : Math.round(n).toLocaleString('es-CO');
const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

// ── GRÁFICAS ─────────────────────────────────────────────────
function updateCharts() {
  const src = filtered.length ? filtered : allData;

  // Agrupar producciones
  const byCultivo = group(src, 'cultivo',          'producci_n_t');
  const byGrupo   = group(src, 'grupo_de_cultivo', 'producci_n_t');
  const byDepto   = group(src, 'departamento',     'producci_n_t');
  const byAnio    = group(src, 'a_o',              'producci_n_t');
  const byCiclo   = group(src, 'ciclo_de_cultivo', 'producci_n_t');
  const byRend    = group(src, 'cultivo',           'rendimiento_t_ha', true);

  renderHBar('chartCultivos', top(byCultivo, 7),  PALETTE, 't');
  renderHBar('chartGrupos',   top(byGrupo,   6),  PALETTE.slice(3), 't');
  renderHBar('chartDeptos',   top(byDepto,   8),  PALETTE.slice(1), 't');
  renderHBar('chartAnios',    sortByKey(byAnio),  PALETTE.slice(2), 't');
  renderHBar('chartCiclo',    top(byCiclo,   5),  PALETTE.slice(4), 't');
  renderHBar('chartRend',     top(byRend,    7),  PALETTE.slice(5), 't/ha');
}

function group(data, field, valField, avg = false) {
  const sums = {}, counts = {};
  data.forEach(r => {
    const k = r[field]; if (!k) return;
    const v = parseFloat(r[valField]) || 0;
    sums[k]   = (sums[k]   || 0) + v;
    counts[k] = (counts[k] || 0) + 1;
  });
  if (avg) {
    return Object.fromEntries(Object.keys(sums).map(k => [k, sums[k] / counts[k]]));
  }
  return sums;
}

const top       = (obj, n)  => Object.fromEntries(Object.entries(obj).sort((a,b)=>b[1]-a[1]).slice(0,n));
const sortByKey = (obj)     => Object.fromEntries(Object.entries(obj).sort((a,b)=>a[0].localeCompare(b[0])));

function renderHBar(containerId, data, colors, unit) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const entries = Object.entries(data);
  if (!entries.length) { container.innerHTML = '<p style="color:var(--text3);font-size:0.78rem;padding:8px">Sin datos</p>'; return; }

  const maxVal = Math.max(...entries.map(e => e[1]));

  container.innerHTML = entries.map(([label, value], i) => {
    const pct   = maxVal > 0 ? (value / maxVal) * 100 : 0;
    const color = colors[i % colors.length];
    const disp  = value >= 1000 ? fmt(value) + ' ' + unit : value.toFixed(1) + ' ' + unit;
    return `
      <div class="hbar-row">
        <span class="hbar-label" title="${label}">${label}</span>
        <div class="hbar-track">
          <div class="hbar-fill" data-pct="${pct.toFixed(1)}" style="background:${color}">
            <span class="hbar-num">${disp}</span>
          </div>
        </div>
      </div>`;
  }).join('');

  // Animate widths after paint
  requestAnimationFrame(() => {
    setTimeout(() => {
      container.querySelectorAll('.hbar-fill').forEach(el => {
        el.style.width = el.dataset.pct + '%';
        el.classList.add('show');
      });
    }, 80);
  });
}

// ── TABLA ────────────────────────────────────────────────────
function renderTable() {
  const start  = (currentPage - 1) * PAGE_SIZE;
  const slice  = filtered.slice(start, start + PAGE_SIZE);

  if (!slice.length) {
    tableBody.innerHTML = `<tr><td colspan="14" class="loading-cell">No se encontraron registros con los filtros aplicados.</td></tr>`;
    return;
  }

  tableBody.innerHTML = slice.map((r, i) => {
    const ciclo = r.ciclo_de_cultivo || '';
    const grupo = r.grupo_de_cultivo || '';
    const grupoClass = grupo.startsWith('FRUTALES') ? 'grupo-FRUTALES'
                     : grupo.startsWith('HORTALIZAS') ? 'grupo-HORTALIZAS'
                     : grupo.startsWith('TUBERCULOS') ? 'grupo-TUBERCULOS'
                     : 'grupo-PLANTAS';
    return `
    <tr>
      <td>${start + i + 1}</td>
      <td>${r.departamento || '—'}</td>
      <td>${r.municipio || '—'}</td>
      <td><span class="${grupoClass}">${grupo || '—'}</span></td>
      <td><strong>${r.cultivo || '—'}</strong></td>
      <td style="font-style:italic;color:var(--text2)">${r.nombre_cientifico || '—'}</td>
      <td class="num-cell">${r.a_o || '—'}</td>
      <td>${r.periodo || '—'}</td>
      <td class="num-cell">${fmtNum(r.rea_sembrada_ha)}</td>
      <td class="num-cell">${fmtNum(r.rea_cosechada_ha)}</td>
      <td class="num-cell">${fmtNum(r.producci_n_t)}</td>
      <td class="num-cell">${fmtRend(r.rendimiento_t_ha)}</td>
      <td style="font-size:0.74rem">${r.estado_fisico_produccion || '—'}</td>
      <td><span class="badge badge-${ciclo}">${ciclo || '—'}</span></td>
    </tr>`;
  }).join('');
}

const fmtNum  = v => v ? parseFloat(v).toLocaleString('es-CO') : '—';
const fmtRend = v => v ? parseFloat(v).toFixed(2) : '—';

// ── PAGINACIÓN ───────────────────────────────────────────────
function updatePager() {
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  pageInfo.textContent = `Pág. ${currentPage} / ${totalPages}`;
  prevBtn.disabled = currentPage <= 1;
  nextBtn.disabled = currentPage >= totalPages;
}

prevBtn.addEventListener('click', () => { currentPage--; renderTable(); updatePager(); window.scrollTo({top: 400, behavior:'smooth'}); });
nextBtn.addEventListener('click', () => { currentPage++; renderTable(); updatePager(); window.scrollTo({top: 400, behavior:'smooth'}); });

// ── LISTENERS ────────────────────────────────────────────────
searchInput.addEventListener('input', () => {
  clearBtn.classList.toggle('visible', searchInput.value.length > 0);
  applyAndRender();
});
clearBtn.addEventListener('click', () => {
  searchInput.value = '';
  clearBtn.classList.remove('visible');
  applyAndRender();
});

[deptoFilter, grupoFilter, cultivoFilter, anioFilter, cicloFilter, sortSelect].forEach(el => {
  el.addEventListener('change', applyAndRender);
});

// ── ARRANQUE ─────────────────────────────────────────────────
fetchData();
