
// ── CONFIG ──────────────────────────────────────────────────
const API_URL = 'https://www.datos.gov.co/resource/2pnw-mmge.json';
const PAGE_SIZE = 50;


const APP_TOKEN = '';

// ── ESTADO ──────────────────────────────────────────────────
let allData = [];
let filtered = [];
let currentPage = 1;
let isLoading = false;

// ── DOM ──────────────────────────────────────────────────────
const searchInput = document.getElementById('searchInput');
const clearBtn = document.getElementById('clearBtn');
const deptoFilter = document.getElementById('deptoFilter');
const grupoFilter = document.getElementById('grupoFilter');
const cultivoFilter = document.getElementById('cultivoFilter');
const anioFilter = document.getElementById('anioFilter');
const cicloFilter = document.getElementById('cicloFilter');
const sortSelect = document.getElementById('sortSelect');
const tableBody = document.getElementById('tableBody');
const resultsCount = document.getElementById('resultsCount');
const pageInfo = document.getElementById('pageInfo');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');

const PALETTE = ['#2D6A4F','#D4A017','#1A6CA8','#7B4F2E','#5A6E2C','#8E4585','#B03A2E','#1A7A7A','#4A4E8C','#C56A14'];

function getTopItems(obj, n) {
  return Object.fromEntries(Object.entries(obj).sort((a,b) => b[1]-a[1]).slice(0,n));
}

function sortByKey(obj) {
  return Object.fromEntries(Object.entries(obj).sort((a,b) => a[0].localeCompare(b[0])));
}

// ── FETCH ────────────────────────────────────────────────────
async function fetchData() {
  if (isLoading) return;
  isLoading = true;
  
  tableBody.innerHTML = `<tr><td colspan="14" class="loading-cell"><div class="loader"></div> Conectando con datos.gov.co...<br><small>⏳ Esto puede tomar unos segundos</small></td></tr>`;
  
  try {
    const params = new URLSearchParams({
      '$limit': 10000,
      '$order': 'a_o DESC'
    });
    
    const url = `${API_URL}?${params}`;
    const headers = { 'Accept': 'application/json' };
    
    if (APP_TOKEN && APP_TOKEN !== '') {
      headers['X-App-Token'] = APP_TOKEN;
      console.log('✅ Usando App Token');
    } else {
      console.warn('⚠️ Sin App Token - resultados limitados a 1000 registros');
    }
    
    console.log('📡 Consultando API:', url);
    
    const response = await fetch(url, { method: 'GET', headers: headers, mode: 'cors' });
    
    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('Acceso denegado (403). Necesitas un App Token de datos.gov.co');
      } else if (response.status === 429) {
        throw new Error('Demasiadas peticiones (429). Espera y recarga');
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    }
    
    allData = await response.json();
    console.log(`✅ Datos cargados: ${allData.length} registros`);
    
    if (allData.length === 0) {
      throw new Error('La API devolvió 0 registros');
    }
    
    init();
    
  } catch (err) {
    console.error('❌ Error:', err);
    
    let errorHtml = `
      <td colspan="14" class="loading-cell">
        <div style="color: #B03A2E; margin-bottom: 12px;">⚠️ Error al cargar datos</div>
        <div style="font-size: 0.8rem; margin-bottom: 16px;">${err.message}</div>
        <div style="font-size: 0.75rem; color: var(--text2); text-align: left; max-width: 500px; margin: 0 auto;">
          <strong>Soluciones:</strong><br>
          1️⃣ Obtén un App Token gratis en <a href="https://datos.gov.co/profile/edit/developer_settings" target="_blank">datos.gov.co</a><br>
          2️⃣ Desactiva extensiones de Chrome que puedan interferir<br>
          3️⃣ Recarga la página
        </div>
       </div>
      </td>
    `;
    
    tableBody.innerHTML = `<table>${errorHtml}</tr>`;
    resultsCount.textContent = '❌ Error de conexión';
  } finally {
    isLoading = false;
  }
}

// ── INICIALIZAR ──────────────────────────────────────────────
function init() {
  populateFilters();
  applyAndRender();
}

function populateFilters() {
  const getUnique = (field) => [...new Set(allData.map(r => r[field]).filter(Boolean))].sort();
  
  clearSelect(deptoFilter);
  clearSelect(grupoFilter);
  clearSelect(cultivoFilter);
  clearSelect(anioFilter);
  clearSelect(cicloFilter);
  
  fillSelect(deptoFilter, getUnique('departamento'));
  fillSelect(grupoFilter, getUnique('grupo_de_cultivo'));
  fillSelect(cultivoFilter, getUnique('cultivo'));
  fillSelect(anioFilter, getUnique('a_o'));
  fillSelect(cicloFilter, getUnique('ciclo_de_cultivo'));
}

function clearSelect(el) {
  while (el.options.length > 1) el.remove(1);
}

function fillSelect(el, values) {
  values.forEach(v => {
    if (v && v.trim()) {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      el.appendChild(opt);
    }
  });
}

function applyAndRender() {
  const q = searchInput.value.trim().toLowerCase();
  const depto = deptoFilter.value;
  const grupo = grupoFilter.value;
  const cultivo = cultivoFilter.value;
  const anio = anioFilter.value;
  const ciclo = cicloFilter.value;
  const sort = sortSelect.value;
  
  filtered = allData.filter(r => {
    if (depto && r.departamento !== depto) return false;
    if (grupo && r.grupo_de_cultivo !== grupo) return false;
    if (cultivo && r.cultivo !== cultivo) return false;
    if (anio && r.a_o !== anio) return false;
    if (ciclo && r.ciclo_de_cultivo !== ciclo) return false;
    if (q) {
      const hay = [r.cultivo, r.municipio, r.departamento, r.nombre_cientifico].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  
  filtered.sort((a, b) => {
    switch (sort) {
      case 'cultivo': return (a.cultivo||'').localeCompare(b.cultivo||'');
      case 'rendimiento-desc': return getNum(b,'rendimiento_t_ha') - getNum(a,'rendimiento_t_ha');
      case 'rendimiento-asc': return getNum(a,'rendimiento_t_ha') - getNum(b,'rendimiento_t_ha');
      case 'produccion-desc': return getNum(b,'producci_n_t') - getNum(a,'producci_n_t');
      case 'area-desc': return getNum(b,'rea_sembrada_ha') - getNum(a,'rea_sembrada_ha');
      case 'anio-desc': return (b.a_o||'').localeCompare(a.a_o||'');
      case 'anio-asc': return (a.a_o||'').localeCompare(b.a_o||'');
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

const getNum = (r, f) => parseFloat(r[f]) || 0;

function updateKPIs() {
  const deptos = new Set(allData.map(r => r.departamento).filter(Boolean));
  const cultivos = new Set(allData.map(r => r.cultivo).filter(Boolean));
  const anios = new Set(allData.map(r => r.a_o).filter(Boolean));
  
  const kpiRegistros = document.getElementById('kpiRegistros');
  const kpiCultivos = document.getElementById('kpiCultivos');
  const kpiDeptos = document.getElementById('kpiDeptos');
  const kpiAnios = document.getElementById('kpiAnios');
  
  if (kpiRegistros) kpiRegistros.textContent = allData.length.toLocaleString('es-CO');
  if (kpiCultivos) kpiCultivos.textContent = cultivos.size;
  if (kpiDeptos) kpiDeptos.textContent = deptos.size;
  if (kpiAnios) kpiAnios.textContent = anios.size;
}

function updateChips() {
  const src = filtered.length ? filtered : allData;
  
  let totalProd = 0, totalArea = 0, totalRend = 0, rendCount = 0;
  const prodPorCultivo = {}, prodPorDepto = {};
  
  src.forEach(r => {
    const p = getNum(r, 'producci_n_t');
    const a = getNum(r, 'rea_sembrada_ha');
    const rd = getNum(r, 'rendimiento_t_ha');
    totalProd += p;
    totalArea += a;
    if (rd > 0) { totalRend += rd; rendCount++; }
    if (r.cultivo) prodPorCultivo[r.cultivo] = (prodPorCultivo[r.cultivo] || 0) + p;
    if (r.departamento) prodPorDepto[r.departamento] = (prodPorDepto[r.departamento] || 0) + p;
  });
  
  const topCultivo = Object.entries(prodPorCultivo).sort((a,b) => b[1]-a[1])[0]?.[0];
  const topDepto = Object.entries(prodPorDepto).sort((a,b) => b[1]-a[1])[0]?.[0];
  const avgRend = rendCount ? (totalRend / rendCount).toFixed(2) : '—';
  
  const formatNumber = n => n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e3 ? (n/1e3).toFixed(1)+'K' : Math.round(n).toLocaleString('es-CO');
  
  const sProd = document.getElementById('sProd');
  const sArea = document.getElementById('sArea');
  const sRend = document.getElementById('sRend');
  const sTopCultivo = document.getElementById('sTopCultivo');
  const sTopDepto = document.getElementById('sTopDepto');
  
  if (sProd) sProd.textContent = formatNumber(totalProd) + ' t';
  if (sArea) sArea.textContent = formatNumber(totalArea) + ' ha';
  if (sRend) sRend.textContent = avgRend + ' t/ha';
  if (sTopCultivo) sTopCultivo.textContent = topCultivo || '—';
  if (sTopDepto) sTopDepto.textContent = topDepto || '—';
  
  if (resultsCount) {
    resultsCount.textContent = `${filtered.length.toLocaleString('es-CO')} registro${filtered.length !== 1 ? 's' : ''} encontrado${filtered.length !== 1 ? 's' : ''}`;
  }
}

function updateCharts() {
  const src = filtered.length ? filtered : allData;
  
  const byCultivo = groupData(src, 'cultivo', 'producci_n_t');
  const byGrupo = groupData(src, 'grupo_de_cultivo', 'producci_n_t');
  const byDepto = groupData(src, 'departamento', 'producci_n_t');
  const byAnio = groupData(src, 'a_o', 'producci_n_t');
  const byCiclo = groupData(src, 'ciclo_de_cultivo', 'producci_n_t');
  const byRend = groupData(src, 'cultivo', 'rendimiento_t_ha', true);
  
  renderHBar('chartCultivos', getTopItems(byCultivo, 7), PALETTE, 't');
  renderHBar('chartGrupos', getTopItems(byGrupo, 6), PALETTE.slice(3), 't');
  renderHBar('chartDeptos', getTopItems(byDepto, 8), PALETTE.slice(1), 't');
  renderHBar('chartAnios', sortByKey(byAnio), PALETTE.slice(2), 't');
  renderHBar('chartCiclo', getTopItems(byCiclo, 5), PALETTE.slice(4), 't');
  renderHBar('chartRend', getTopItems(byRend, 7), PALETTE.slice(5), 't/ha');
}

function groupData(data, field, valField, avg = false) {
  const sums = {}, counts = {};
  data.forEach(r => {
    const k = r[field]; if (!k) return;
    const v = parseFloat(r[valField]) || 0;
    sums[k] = (sums[k] || 0) + v;
    counts[k] = (counts[k] || 0) + 1;
  });
  if (avg) return Object.fromEntries(Object.keys(sums).map(k => [k, sums[k] / counts[k]]));
  return sums;
}

function renderHBar(containerId, data, colors, unit) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  const entries = Object.entries(data);
  if (!entries.length) { 
    container.innerHTML = '<p style="color:var(--text3);font-size:0.78rem;padding:8px">Sin datos</p>'; 
    return; 
  }
  
  const maxVal = Math.max(...entries.map(e => e[1]));
  const formatNumber = n => n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e3 ? (n/1e3).toFixed(1)+'K' : Math.round(n);
  
  container.innerHTML = entries.map(([label, value], i) => {
    const pct = maxVal > 0 ? (value / maxVal) * 100 : 0;
    const color = colors[i % colors.length];
    const displayValue = value >= 1000 ? formatNumber(value) + ' ' + unit : value.toFixed(1) + ' ' + unit;
    return `<div class="hbar-row"><span class="hbar-label" title="${label}">${label}</span><div class="hbar-track"><div class="hbar-fill" data-pct="${pct.toFixed(1)}" style="background:${color}"><span class="hbar-num">${displayValue}</span></div></div></div>`;
  }).join('');
  
  requestAnimationFrame(() => {
    setTimeout(() => {
      container.querySelectorAll('.hbar-fill').forEach(el => {
        el.style.width = el.dataset.pct + '%';
        el.classList.add('show');
      });
    }, 80);
  });
}

function renderTable() {
  if (!tableBody) return;
  
  const start = (currentPage - 1) * PAGE_SIZE;
  const slice = filtered.slice(start, start + PAGE_SIZE);
  
  if (!slice.length) {
    tableBody.innerHTML = `<tr><td colspan="14" class="loading-cell">No se encontraron registros con los filtros aplicados.</td></tr>`;
    return;
  }
  
  tableBody.innerHTML = slice.map((r, i) => {
    const ciclo = r.ciclo_de_cultivo || '';
    return `<tr>
      <td>${start + i + 1}</td>
      <td>${r.departamento || '—'}</td>
      <td>${r.municipio || '—'}</td>
      <td>${r.grupo_de_cultivo || '—'}</td>
      <td><strong>${r.cultivo || '—'}</strong></td>
      <td style="font-style:italic;color:var(--text2)">${r.nombre_cientifico || '—'}</td>
      <td class="num-cell">${r.a_o || '—'}</td>
      <td>${r.periodo || '—'}</td>
      <td class="num-cell">${formatNumberValue(r.rea_sembrada_ha)}</td>
      <td class="num-cell">${formatNumberValue(r.rea_cosechada_ha)}</td>
      <td class="num-cell">${formatNumberValue(r.producci_n_t)}</td>
      <td class="num-cell">${formatRendimiento(r.rendimiento_t_ha)}</td>
      <td>${r.estado_fisico_produccion || '—'}</td>
      <td><span class="badge badge-${ciclo}">${ciclo || '—'}</span></td>
    </tr>`;
  }).join('');
}

const formatNumberValue = v => v ? parseFloat(v).toLocaleString('es-CO') : '—';
const formatRendimiento = v => v ? parseFloat(v).toFixed(2) : '—';

function updatePager() {
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (pageInfo) pageInfo.textContent = `Pág. ${currentPage} / ${totalPages}`;
  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
}

// ── EVENT LISTENERS ──────────────────────────────────────────
if (prevBtn) {
  prevBtn.addEventListener('click', () => { 
    currentPage--; 
    renderTable(); 
    updatePager(); 
    window.scrollTo({top: 400, behavior:'smooth'}); 
  });
}

if (nextBtn) {
  nextBtn.addEventListener('click', () => { 
    currentPage++; 
    renderTable(); 
    updatePager(); 
    window.scrollTo({top: 400, behavior:'smooth'}); 
  });
}

if (searchInput) {
  searchInput.addEventListener('input', () => {
    if (clearBtn) clearBtn.classList.toggle('visible', searchInput.value.length > 0);
    applyAndRender();
  });
}

if (clearBtn) {
  clearBtn.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    if (clearBtn) clearBtn.classList.remove('visible');
    applyAndRender();
  });
}

[deptoFilter, grupoFilter, cultivoFilter, anioFilter, cicloFilter, sortSelect].forEach(el => {
  if (el) el.addEventListener('change', applyAndRender);
});

// ── ARRANQUE ─────────────────────────────────────────────────
fetchData();
