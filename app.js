

const API_URL = 'https://www.datos.gov.co/resource/2pnw-mmge.json';
const PAGE_SIZE = 50;
const APP_TOKEN = 'zx7odryLe9M4i3jda4o4P5LjL';

let allData = [];
let filtered = [];
let currentPage = 1;

// DOM Elements
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

const PALETTE = ['#2D6A4F','#D4A017','#1A6CA8','#7B4F2E','#5A6E2C','#8E4585','#B03A2E'];

// ========== FUNCIONES PRINCIPALES ==========

async function fetchData() {
  if (!tableBody) return;
  
  tableBody.innerHTML = `<tr><td colspan="14" class="loading-cell"><div class="loader"></div> Cargando datos desde datos.gov.co...</td></tr>`;
  
  try {
    const params = new URLSearchParams({ '$limit': 5000, '$order': 'a_o DESC' });
    const headers = { 'Accept': 'application/json' };
    if (APP_TOKEN && APP_TOKEN !== '') headers['X-App-Token'] = APP_TOKEN;
    
    const response = await fetch(`${API_URL}?${params}`, { headers });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    allData = await response.json();
    console.log(`✅ ${allData.length} registros cargados`);
    init();
    
  } catch (err) {
    console.error(err);
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="14" class="loading-cell">⚠️ Error: ${err.message}<br><small>Intenta recargar o contacta soporte</small></td></tr>`;
    }
    if (resultsCount) resultsCount.textContent = 'Error de carga';
  }
}

function init() {
  populateFilters();
  applyFilters();
}

function populateFilters() {
  const getUnique = (field) => [...new Set(allData.map(r => r[field]).filter(Boolean))].sort();
  
  const deptos = getUnique('departamento');
  const grupos = getUnique('grupo_de_cultivo');
  const cultivos = getUnique('cultivo');
  const anios = getUnique('a_o');
  const ciclos = getUnique('ciclo_de_cultivo');
  
  if (deptoFilter) fillSelect(deptoFilter, deptos);
  if (grupoFilter) fillSelect(grupoFilter, grupos);
  if (cultivoFilter) fillSelect(cultivoFilter, cultivos);
  if (anioFilter) fillSelect(anioFilter, anios);
  if (cicloFilter) fillSelect(cicloFilter, ciclos);
}

function fillSelect(select, values) {
  if (!select) return;
  while (select.options.length > 1) select.remove(1);
  values.forEach(v => {
    if (v && v.trim()) {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      select.appendChild(opt);
    }
  });
}

function applyFilters() {
  if (!allData.length) return;
  
  const searchTerm = searchInput?.value.trim().toLowerCase() || '';
  const depto = deptoFilter?.value || '';
  const grupo = grupoFilter?.value || '';
  const cultivo = cultivoFilter?.value || '';
  const anio = anioFilter?.value || '';
  const ciclo = cicloFilter?.value || '';
  const sortBy = sortSelect?.value || '';
  
  filtered = allData.filter(r => {
    if (depto && r.departamento !== depto) return false;
    if (grupo && r.grupo_de_cultivo !== grupo) return false;
    if (cultivo && r.cultivo !== cultivo) return false;
    if (anio && r.a_o !== anio) return false;
    if (ciclo && r.ciclo_de_cultivo !== ciclo) return false;
    if (searchTerm) {
      const text = [r.cultivo, r.municipio, r.departamento, r.nombre_cientifico].filter(Boolean).join(' ').toLowerCase();
      if (!text.includes(searchTerm)) return false;
    }
    return true;
  });
  
  // Ordenar
  filtered.sort((a, b) => {
    const getVal = (r, f) => parseFloat(r[f]) || 0;
    switch (sortBy) {
      case 'cultivo': return (a.cultivo || '').localeCompare(b.cultivo || '');
      case 'rendimiento-desc': return getVal(b, 'rendimiento_t_ha') - getVal(a, 'rendimiento_t_ha');
      case 'rendimiento-asc': return getVal(a, 'rendimiento_t_ha') - getVal(b, 'rendimiento_t_ha');
      case 'produccion-desc': return getVal(b, 'producci_n_t') - getVal(a, 'producci_n_t');
      case 'area-desc': return getVal(b, 'rea_sembrada_ha') - getVal(a, 'rea_sembrada_ha');
      case 'anio-desc': return (b.a_o || '').localeCompare(a.a_o || '');
      case 'anio-asc': return (a.a_o || '').localeCompare(b.a_o || '');
      default: return 0;
    }
  });
  
  currentPage = 1;
  updateStats();
  renderTable();
  updatePagination();
}

function updateStats() {
  const src = filtered.length ? filtered : allData;
  
  let totalProd = 0, totalArea = 0;
  const cultivosSet = new Set();
  const deptosSet = new Set();
  
  src.forEach(r => {
    totalProd += parseFloat(r.producci_n_t) || 0;
    totalArea += parseFloat(r.rea_sembrada_ha) || 0;
    if (r.cultivo) cultivosSet.add(r.cultivo);
    if (r.departamento) deptosSet.add(r.departamento);
  });
  
  const fmt = n => n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e3 ? (n/1e3).toFixed(1)+'K' : Math.round(n).toLocaleString();
  
  if (resultsCount) resultsCount.textContent = `${filtered.length} registros encontrados`;
  
  const sProd = document.getElementById('sProd');
  const sArea = document.getElementById('sArea');
  const sTopCultivo = document.getElementById('sTopCultivo');
  const sTopDepto = document.getElementById('sTopDepto');
  
  if (sProd) sProd.textContent = fmt(totalProd) + ' t';
  if (sArea) sArea.textContent = fmt(totalArea) + ' ha';
  if (sTopCultivo) sTopCultivo.textContent = cultivosSet.size;
  if (sTopDepto) sTopDepto.textContent = deptosSet.size;
  
  // KPIs
  const kpiRegistros = document.getElementById('kpiRegistros');
  const kpiCultivos = document.getElementById('kpiCultivos');
  const kpiDeptos = document.getElementById('kpiDeptos');
  const kpiAnios = document.getElementById('kpiAnios');
  
  if (kpiRegistros) kpiRegistros.textContent = allData.length.toLocaleString();
  if (kpiCultivos) kpiCultivos.textContent = new Set(allData.map(r => r.cultivo).filter(Boolean)).size;
  if (kpiDeptos) kpiDeptos.textContent = new Set(allData.map(r => r.departamento).filter(Boolean)).size;
  if (kpiAnios) kpiAnios.textContent = new Set(allData.map(r => r.a_o).filter(Boolean)).size;
}

function renderTable() {
  if (!tableBody) return;
  
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageData = filtered.slice(start, start + PAGE_SIZE);
  
  if (!pageData.length) {
    tableBody.innerHTML = `<tr><td colspan="14" class="loading-cell">No hay registros con estos filtros</td></tr>`;
    return;
  }
  
  tableBody.innerHTML = pageData.map((r, i) => `
    <tr>
      <td>${start + i + 1}</td>
      <td>${r.departamento || '—'}</td>
      <td>${r.municipio || '—'}</td>
      <td>${r.grupo_de_cultivo || '—'}</td>
      <td><strong>${r.cultivo || '—'}</strong></td>
      <td><em>${r.nombre_cientifico || '—'}</em></td>
      <td>${r.a_o || '—'}</td>
      <td>${r.periodo || '—'}</td>
      <td class="num-cell">${formatNumber(r.rea_sembrada_ha)}</td>
      <td class="num-cell">${formatNumber(r.rea_cosechada_ha)}</td>
      <td class="num-cell">${formatNumber(r.producci_n_t)}</td>
      <td class="num-cell">${formatDecimal(r.rendimiento_t_ha)}</td>
      <td>${r.estado_fisico_produccion || '—'}</td>
      <td>${r.ciclo_de_cultivo || '—'}</td>
    </tr>
  `).join('');
}

function formatNumber(v) {
  if (!v) return '—';
  const n = parseFloat(v);
  return isNaN(n) ? '—' : n.toLocaleString('es-CO');
}

function formatDecimal(v) {
  if (!v) return '—';
  const n = parseFloat(v);
  return isNaN(n) ? '—' : n.toFixed(2);
}

function updatePagination() {
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (pageInfo) pageInfo.textContent = `Pág. ${currentPage} / ${totalPages}`;
  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
}

// ========== EVENTOS ==========
if (prevBtn) {
  prevBtn.addEventListener('click', () => {
    currentPage--;
    renderTable();
    updatePagination();
    window.scrollTo({ top: 400, behavior: 'smooth' });
  });
}

if (nextBtn) {
  nextBtn.addEventListener('click', () => {
    currentPage++;
    renderTable();
    updatePagination();
    window.scrollTo({ top: 400, behavior: 'smooth' });
  });
}

if (searchInput) {
  searchInput.addEventListener('input', () => {
    if (clearBtn) clearBtn.classList.toggle('visible', searchInput.value.length > 0);
    applyFilters();
  });
}

if (clearBtn) {
  clearBtn.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    if (clearBtn) clearBtn.classList.remove('visible');
    applyFilters();
  });
}

[deptoFilter, grupoFilter, cultivoFilter, anioFilter, cicloFilter, sortSelect].forEach(el => {
  if (el) el.addEventListener('change', applyFilters);
});

// ========== INICIAR ==========
fetchData();
