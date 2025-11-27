const { ipcRenderer } = require('electron');
const odbc = require('odbc');
const conexionfacturas = 'DSN=facturas';
const Swal = require('sweetalert2');

// Variables globales
let notasCreditoData = [];
let currentSearchType = 'rango';
let productosAgregados = [];

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    attachEventListeners();
    setDefaultDates();
});

// Inicializar la aplicación
function initializeApp() {
    // Cargar nombre de usuario
    const userName = localStorage.getItem('userName') || 'Usuario';
    document.getElementById('userName').textContent = userName;
    
    // Animar elementos al cargar
    animatePageElements();
}

// Animar elementos de la página
function animatePageElements() {
    const elements = [
        document.querySelector('.main-header'),
        document.querySelector('.search-panel'),
        document.querySelector('.results-panel')
    ];
    
    elements.forEach((element, index) => {
        if (element) {
            element.style.opacity = '0';
            element.style.transform = 'translateY(20px)';
            element.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            
            setTimeout(() => {
                element.style.opacity = '1';
                element.style.transform = 'translateY(0)';
            }, 100 + (index * 150));
        }
    });
}

// Establecer fechas por defecto (último mes)
function setDefaultDates() {
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
    
    document.getElementById('fechaInicio').valueAsDate = lastMonth;
    document.getElementById('fechaFin').valueAsDate = today;
}

// ============================================
// EVENT LISTENERS
// ============================================
function attachEventListeners() {
    
    // Botones de tipo de búsqueda
    const searchTypeBtns = document.querySelectorAll('.search-type-btn');
    searchTypeBtns.forEach(btn => {
        btn.addEventListener('click', () => changeSearchType(btn.dataset.type));
    });
    
    // Botones de búsqueda
    document.getElementById('btnBuscarRango').addEventListener('click', buscarPorRango);
    document.getElementById('btnBuscarNumero').addEventListener('click', buscarPorNumero);
    document.getElementById('btnBuscarSerie').addEventListener('click', buscarPorSerie);
    
    // Botón limpiar
    document.getElementById('btnLimpiar').addEventListener('click', limpiarResultados);
    
    // Enter en los inputs
    document.getElementById('numeroNC').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') buscarPorNumero();
    });
    
    document.getElementById('serieNC').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') buscarPorSerie();
    });
}

// ============================================
// CAMBIO DE TIPO DE BÚSQUEDA
// ============================================
function changeSearchType(type) {
    currentSearchType = type;
    
    // Actualizar botones activos
    document.querySelectorAll('.search-type-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.closest('.search-type-btn').classList.add('active');
    
    // Mostrar formulario correspondiente
    document.querySelectorAll('.search-form').forEach(form => {
        form.classList.remove('active');
    });
    
    switch(type) {
        case 'rango':
            document.getElementById('searchByRango').classList.add('active');
            break;
        case 'numero':
            document.getElementById('searchByNumero').classList.add('active');
            document.getElementById('numeroNC').focus();
            break;
        case 'serie':
            document.getElementById('searchBySerie').classList.add('active');
            document.getElementById('serieNC').focus();
            break;
    }
}

// ============================================
// FUNCIONES DE BÚSQUEDA
// ============================================

// Buscar por rango de fechas
async function buscarPorRango() {
    const fechaInicio = document.getElementById('fechaInicio').value;
    const fechaFin = document.getElementById('fechaFin').value;
    
    if (!fechaInicio || !fechaFin) {
        showToast('error', 'Por favor selecciona ambas fechas');
        return;
    }
    
    if (new Date(fechaInicio) > new Date(fechaFin)) {
        showToast('error', 'La fecha de inicio no puede ser mayor a la fecha fin');
        return;
    }
    
    const query = `
        SELECT 
            NCTProveedores.IdNotaCreditoProveedores,
            NCTProveedores.IdFacturaCompras,
            NCTProveedores.IdProveedor,
            NCTProveedores.NombreProveedore,
            NCTProveedores.NIT,
            NCTProveedores.Monto,
            NCTProveedores.Serie,
            NCTProveedores.Numero,
            NCTProveedores.TipoNotaCredito,
            NCTProveedores.FechaNotaCredito,
            NCTProveedores.Observaciones,
            NCTProveedores.FechaHoraRegistro,
            NCTProveedores.IdUsuario,
            NCTProveedores.NombreUsuario,
            NCTProveedores.IdConcepto
        FROM NCTProveedores
        WHERE NCTProveedores.FechaNotaCredito BETWEEN ? AND ?
        ORDER BY NCTProveedores.FechaNotaCredito DESC
    `;
    
    await ejecutarBusqueda(query, [fechaInicio, fechaFin]);
}

// Buscar por número
async function buscarPorNumero() {
    const numero = document.getElementById('numeroNC').value.trim();
    
    if (!numero) {
        showToast('error', 'Por favor ingresa un número de nota de crédito');
        document.getElementById('numeroNC').focus();
        return;
    }
    
    const query = `
        SELECT 
            NCTProveedores.IdNotaCreditoProveedores,
            NCTProveedores.IdFacturaCompras,
            NCTProveedores.IdProveedor,
            NCTProveedores.NombreProveedore,
            NCTProveedores.NIT,
            NCTProveedores.Monto,
            NCTProveedores.Serie,
            NCTProveedores.Numero,
            NCTProveedores.TipoNotaCredito,
            NCTProveedores.FechaNotaCredito,
            NCTProveedores.Observaciones,
            NCTProveedores.FechaHoraRegistro,
            NCTProveedores.IdUsuario,
            NCTProveedores.NombreUsuario,
            NCTProveedores.IdConcepto
        FROM NCTProveedores
        WHERE NCTProveedores.Numero = ?
        ORDER BY NCTProveedores.FechaNotaCredito DESC
    `;
    
    await ejecutarBusqueda(query, [numero]);
}

// Buscar por serie
async function buscarPorSerie() {
    const serie = document.getElementById('serieNC').value.trim().toUpperCase();
    
    if (!serie) {
        showToast('error', 'Por favor ingresa una serie de nota de crédito');
        document.getElementById('serieNC').focus();
        return;
    }
    
    const query = `
        SELECT 
            NCTProveedores.IdNotaCreditoProveedores,
            NCTProveedores.IdFacturaCompras,
            NCTProveedores.IdProveedor,
            NCTProveedores.NombreProveedore,
            NCTProveedores.NIT,
            NCTProveedores.Monto,
            NCTProveedores.Serie,
            NCTProveedores.Numero,
            NCTProveedores.TipoNotaCredito,
            NCTProveedores.FechaNotaCredito,
            NCTProveedores.Observaciones,
            NCTProveedores.FechaHoraRegistro,
            NCTProveedores.IdUsuario,
            NCTProveedores.NombreUsuario,
            NCTProveedores.IdConcepto
        FROM NCTProveedores
        WHERE NCTProveedores.Serie = ?
        ORDER BY NCTProveedores.FechaNotaCredito DESC
    `;
    
    await ejecutarBusqueda(query, [serie]);
}

// ============================================
// EJECUTAR BÚSQUEDA EN BASE DE DATOS
// ============================================
async function ejecutarBusqueda(query, params) {
    showLoading(true);
    
    try {
        const connection = await odbc.connect(conexionfacturas);
        const result = await connection.query(query, params);
        await connection.close();
        
        if (result.length === 0) {
            showToast('info', 'No se encontraron notas de crédito con los criterios de búsqueda');
            mostrarResultadosVacios();
        } else {
            notasCreditoData = result;
            mostrarResultados(result);
            showToast('success', `Se encontraron ${result.length} nota(s) de crédito`);
        }
        
    } catch (error) {
        console.error('Error al buscar notas de crédito:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error de conexión',
            text: 'No se pudo conectar a la base de datos. Por favor verifica tu conexión.',
            confirmButtonColor: '#6e78ff',
            background: '#1e2132',
            color: '#e4e6eb'
        });
    } finally {
        showLoading(false);
    }
}

// ============================================
// MOSTRAR RESULTADOS EN LA TABLA
// ============================================
function mostrarResultados(data) {
    const tableBody = document.getElementById('tableBody');
    tableBody.innerHTML = '';
    
    data.forEach((nota, index) => {
        const row = document.createElement('tr');
        row.style.animation = `slideIn 0.3s ease forwards`;
        row.style.animationDelay = `${index * 0.05}s`;
        row.style.opacity = '0';
        
        // Determinar el concepto
        const concepto = nota.IdConcepto == 1 ? 
            '<span class="badge badge-mercaderia"><i class="fas fa-box"></i> Mercadería</span>' :
            '<span class="badge badge-otros"><i class="fas fa-file-invoice"></i> Otros Conceptos</span>';
        
        // Formatear monto
        const montoFormateado = formatearMoneda(nota.Monto);
        
        // Formatear fecha
        const fechaFormateada = formatearFecha(nota.FechaNotaCredito);
        
        row.innerHTML = `
            <td class="font-bold text-primary">${nota.IdNotaCreditoProveedores}</td>
            <td>${nota.Serie || 'N/A'}</td>
            <td class="font-bold">${nota.Numero}</td>
            <td>${nota.NombreProveedore}</td>
            <td>${nota.NIT || 'N/A'}</td>
            <td class="text-success font-bold">${montoFormateado}</td>
            <td>${nota.TipoNotaCredito || 'N/A'}</td>
            <td>${concepto}</td>
            <td>${fechaFormateada}</td>
            <td>${nota.NombreUsuario || 'N/A'}</td>
            <td>
                <div style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" 
                     title="${nota.Observaciones || 'Sin observaciones'}">
                    ${nota.Observaciones || 'Sin observaciones'}
                </div>
            </td>
            <td class="action-column">
                <button class="btn btn-edit" onclick="modificarNotaCredito(${nota.IdNotaCreditoProveedores})">
                    <i class="fas fa-edit"></i> Modificar
                </button>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
    
    // Actualizar contador de resultados
    document.getElementById('resultsCount').textContent = `${data.length} registro${data.length !== 1 ? 's' : ''} encontrado${data.length !== 1 ? 's' : ''}`;
}

// Mostrar tabla vacía
function mostrarResultadosVacios() {
    const tableBody = document.getElementById('tableBody');
    tableBody.innerHTML = `
        <tr class="empty-state">
            <td colspan="12">
                <div class="empty-content">
                    <i class="fas fa-search"></i>
                    <p>No se encontraron resultados</p>
                    <small style="color: var(--text-tertiary); font-size: 13px;">
                        Intenta con otros criterios de búsqueda
                    </small>
                </div>
            </td>
        </tr>
    `;
    
    document.getElementById('resultsCount').textContent = '0 registros encontrados';
    notasCreditoData = [];
}

// ============================================
// LIMPIAR RESULTADOS
// ============================================
function limpiarResultados() {
    const tableBody = document.getElementById('tableBody');
    tableBody.innerHTML = `
        <tr class="empty-state">
            <td colspan="12">
                <div class="empty-content">
                    <i class="fas fa-search"></i>
                    <p>Realiza una búsqueda para ver los resultados</p>
                </div>
            </td>
        </tr>
    `;
    
    document.getElementById('resultsCount').textContent = '0 registros encontrados';
    notasCreditoData = [];
    
    // Limpiar inputs
    document.getElementById('numeroNC').value = '';
    document.getElementById('serieNC').value = '';
    setDefaultDates();
    
    showToast('info', 'Resultados limpiados');
}

// ============================================
// MODIFICAR NOTA DE CRÉDITO
// ============================================
function modificarNotaCredito(idNotaCredito) {
    // Buscar la nota de crédito en los datos cargados
    const nota = notasCreditoData.find(n => n.IdNotaCreditoProveedores === idNotaCredito);
    
    if (!nota) {
        showToast('error', 'No se encontró la nota de crédito seleccionada');
        return;
    }
    
    // Guardar en localStorage para usar en otra ventana o modal
    localStorage.setItem('notaCreditoEditar', JSON.stringify(nota));
    
    // Mostrar modal de edición con SweetAlert2
    mostrarModalEdicion(nota);
}

// Modal de edición (ejemplo básico)
async function mostrarModalEdicion(nota) {
    // Si es por mercadería, cargar el detalle
    let detalleProductos = [];
    if (nota.IdConcepto == 1) {
        try {
            const connection = await odbc.connect(conexionfacturas);
            const queryDetalle = `
                SELECT
                    NCTProveedoresDetalle.IdNTCProveedor, 
                    NCTProveedoresDetalle.Upc, 
                    NCTProveedoresDetalle.Descripcion, 
                    NCTProveedoresDetalle.Cantidad
                FROM
                    NCTProveedoresDetalle
                WHERE
                    NCTProveedoresDetalle.IdNTCProveedor = ?
            `;
            detalleProductos = await connection.query(queryDetalle, [nota.IdNotaCreditoProveedores]);
            await connection.close();
        } catch (error) {
            console.error('Error al cargar detalle de productos:', error);
            showToast('error', 'No se pudo cargar el detalle de productos');
        }
    }
    
    const { value: formValues } = await Swal.fire({
        title: `<div style="display: flex; align-items: center; gap: 10px; justify-content: center;">
                    <i class="fas fa-edit" style="color: #6e78ff;"></i>
                    <span>Modificar Nota de Crédito</span>
                </div>`,
        html: `
            <div style="text-align: left; padding: 5px; max-height: 70vh; overflow-y: auto;">
                
                <!-- ID de la Nota -->
                <div style="background: linear-gradient(135deg, #6e78ff, #5661e6); padding: 12px; border-radius: 10px; margin-bottom: 20px; text-align: center;">
                    <div style="font-size: 12px; color: rgba(255,255,255,0.8); margin-bottom: 4px;">ID Nota de Crédito</div>
                    <div style="font-size: 24px; font-weight: 700; color: white;">#${nota.IdNotaCreditoProveedores}</div>
                </div>

                <!-- Grid de información principal -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                    
                    <!-- Serie -->
                    <div style="background: #23273a; padding: 15px; border-radius: 10px; border: 1px solid #2d3142;">
                        <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; color: #8b94ff; font-size: 12px; font-weight: 600;">
                            <i class="fas fa-barcode"></i> SERIE
                        </label>
                        <input id="swal-serie" class="swal2-input" type="text" value="${nota.Serie || ''}" 
                               placeholder="Ingrese serie"
                               style="background: #1a1d29; color: #e4e6eb; border: 2px solid #2d3142; padding: 12px; 
                                      border-radius: 8px; width: 100%; margin: 0; font-size: 14px; font-weight: 600; text-transform: uppercase;">
                    </div>
                    
                    <!-- Número -->
                    <div style="background: #23273a; padding: 15px; border-radius: 10px; border: 1px solid #2d3142;">
                        <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; color: #8b94ff; font-size: 12px; font-weight: 600;">
                            <i class="fas fa-hashtag"></i> NÚMERO
                        </label>
                        <input id="swal-numero" class="swal2-input" type="number" value="${nota.Numero}" 
                               placeholder="Ingrese número"
                               style="background: #1a1d29; color: #e4e6eb; border: 2px solid #2d3142; padding: 12px; 
                                      border-radius: 8px; width: 100%; margin: 0; font-size: 14px; font-weight: 600;">
                    </div>
                </div>

                <!-- Proveedor (solo lectura) -->
                <div style="background: #23273a; padding: 15px; border-radius: 10px; border: 1px solid #2d3142; margin-bottom: 15px;">
                    <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; color: #8b94ff; font-size: 12px; font-weight: 600;">
                        <i class="fas fa-building"></i> PROVEEDOR
                    </label>
                    <input id="swal-proveedor" class="swal2-input" value="${nota.NombreProveedore}" readonly 
                           style="background: #1a1d29; color: #b0b3b8; border: 2px solid #2d3142; padding: 12px; 
                                  border-radius: 8px; width: 100%; margin: 0; font-size: 13px; cursor: not-allowed; opacity: 0.7;">
                    <div style="display: flex; align-items: center; gap: 6px; margin-top: 8px; font-size: 11px; color: #8a8d93;">
                        <i class="fas fa-id-card"></i>
                        <span>NIT: ${nota.NIT || 'N/A'}</span>
                    </div>
                </div>

                <!-- Grid de Monto y Fecha -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                    
                    <!-- Monto -->
                    <div style="background: #23273a; padding: 15px; border-radius: 10px; border: 1px solid #2d3142;">
                        <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; color: #66bb6a; font-size: 12px; font-weight: 600;">
                            <i class="fas fa-dollar-sign"></i> MONTO (Q)
                        </label>
                        <input id="swal-monto" class="swal2-input" type="number" step="0.01" value="${nota.Monto}"
                               placeholder="0.00"
                               style="background: #1a1d29; color: #66bb6a; border: 2px solid #2d3142; padding: 12px; 
                                      border-radius: 8px; width: 100%; margin: 0; font-size: 16px; font-weight: 700;">
                    </div>
                    
                    <!-- Fecha -->
                    <div style="background: #23273a; padding: 15px; border-radius: 10px; border: 1px solid #2d3142;">
                        <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; color: #8b94ff; font-size: 12px; font-weight: 600;">
                            <i class="fas fa-calendar"></i> FECHA
                        </label>
                        <input id="swal-fecha" class="swal2-input" type="date" value="${nota.FechaNotaCredito}"
                               style="background: #1a1d29; color: #e4e6eb; border: 2px solid #2d3142; padding: 12px; 
                                      border-radius: 8px; width: 100%; margin: 0; font-size: 13px;">
                    </div>
                </div>

                <!-- Concepto (solo lectura con badge) -->
                <div style="background: #23273a; padding: 15px; border-radius: 10px; border: 1px solid #2d3142; margin-bottom: 15px;">
                    <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; color: #8b94ff; font-size: 12px; font-weight: 600;">
                        <i class="fas fa-list"></i> CONCEPTO
                    </label>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        ${nota.IdConcepto == 1 ? 
                            '<span style="background: rgba(76, 175, 80, 0.15); color: #66bb6a; padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 600; border: 1px solid rgba(76, 175, 80, 0.3); display: inline-flex; align-items: center; gap: 6px;"><i class="fas fa-box"></i> POR MERCADERÍA</span>' :
                            '<span style="background: rgba(255, 152, 0, 0.15); color: #ff9800; padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 600; border: 1px solid rgba(255, 152, 0, 0.3); display: inline-flex; align-items: center; gap: 6px;"><i class="fas fa-file-invoice"></i> POR OTROS CONCEPTOS</span>'
                        }
                    </div>
                </div>

                <!-- Observaciones -->
                <div style="background: #23273a; padding: 15px; border-radius: 10px; border: 1px solid #2d3142;">
                    <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; color: #8b94ff; font-size: 12px; font-weight: 600;">
                        <i class="fas fa-comment-dots"></i> OBSERVACIONES
                    </label>
                    <textarea id="swal-observaciones" class="swal2-textarea" rows="4"
                              placeholder="Ingrese observaciones adicionales..."
                              style="background: #1a1d29; color: #e4e6eb; border: 2px solid #2d3142; padding: 12px; 
                                     border-radius: 8px; width: 100%; margin: 0; font-size: 13px; resize: vertical; 
                                     font-family: 'Inter', sans-serif; line-height: 1.5;">${nota.Observaciones || ''}</textarea>
                </div>

                ${nota.IdConcepto == 1 && detalleProductos.length > 0 ? `
                <!-- Detalle de Productos -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <label style="display: flex; align-items: center; gap: 8px; color: #66bb6a; font-size: 13px; font-weight: 600;">
                        <i class="fas fa-box"></i> DETALLE DE MERCADERÍA
                    </label>
                    <button onclick="abrirBusquedaProductos(${nota.IdNotaCreditoProveedores})" 
                            type="button"
                            style="background: linear-gradient(135deg, #66bb6a, #4caf50); color: white; border: none; 
                                padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 600; 
                                cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.3s ease;">
                        <i class="fas fa-plus"></i> Agregar Producto
                    </button>
                </div>
                ${detalleProductos.length > 0 ? `
                <div style="background: #1a1d29; border-radius: 8px; overflow: hidden; border: 1px solid #2d3142;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                        <thead>
                            <tr style="background: linear-gradient(135deg, #2d3142, #23273a);">
                                <th style="padding: 10px 12px; text-align: left; color: #8b94ff; font-weight: 600; font-size: 11px; border-bottom: 2px solid #2d3142;">UPC</th>
                                <th style="padding: 10px 12px; text-align: left; color: #8b94ff; font-weight: 600; font-size: 11px; border-bottom: 2px solid #2d3142;">DESCRIPCIÓN</th>
                                <th style="padding: 10px 12px; text-align: center; color: #66bb6a; font-weight: 600; font-size: 11px; border-bottom: 2px solid #2d3142; width: 120px;">CANTIDAD</th>
                                <th style="padding: 10px 12px; text-align: center; color: #ff5e6d; font-weight: 600; font-size: 11px; border-bottom: 2px solid #2d3142; width: 100px;">ACCIONES</th>
                            </tr>
                        </thead>
                        <tbody id="detalle-productos-tbody">
                            ${detalleProductos.map((producto, index) => `
                                <tr style="border-bottom: 1px solid #2d3142;">
                                    <td style="padding: 10px 12px; color: #b0b3b8;">
                                        <div style="display: flex; align-items: center; gap: 6px;">
                                            <i class="fas fa-barcode" style="color: #6e78ff; font-size: 10px;"></i>
                                            <span>${producto.Upc || 'N/A'}</span>
                                        </div>
                                    </td>
                                    <td style="padding: 10px 12px; color: #e4e6eb;">${producto.Descripcion || 'Sin descripción'}</td>
                                    <td style="padding: 10px 12px; text-align: center;">
                                        <input 
                                            type="number" 
                                            class="cantidad-producto" 
                                            data-upc="${producto.Upc}"
                                            data-index="${index}"
                                            value="${producto.Cantidad}" 
                                            min="0"
                                            step="1"
                                            style="background: #0f1117; color: #66bb6a; border: 2px solid #2d3142; padding: 6px 10px; 
                                                border-radius: 6px; width: 80px; text-align: center; font-size: 13px; font-weight: 700;
                                                transition: all 0.3s ease;">
                                    </td>
                                    <td style="padding: 10px 12px; text-align: center;">
                                        <button 
                                            type="button"
                                            onclick="eliminarProductoDetalle(${nota.IdNotaCreditoProveedores}, '${producto.Upc}', '${producto.Descripcion.replace(/'/g, "\\'")}')"
                                            style="background: linear-gradient(135deg, #ff5e6d, #ff7985); color: white; border: none; 
                                                padding: 6px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; 
                                                cursor: pointer; display: inline-flex; align-items: center; gap: 4px; 
                                                transition: all 0.3s ease;"
                                            onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 0 15px rgba(255, 94, 109, 0.4)';"
                                            onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='none';">
                                            <i class="fas fa-trash"></i>
                                            <span>Eliminar</span>
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                ` : `
                <div style="padding: 20px; text-align: center; color: #8a8d93; font-size: 12px; background: #1a1d29; border-radius: 8px; border: 1px solid #2d3142;">
                    <i class="fas fa-box-open" style="font-size: 32px; opacity: 0.3; margin-bottom: 10px; display: block;"></i>
                    <p style="margin-bottom: 5px;">No hay productos agregados aún</p>
                    <p style="font-size: 11px; margin-top: 5px; color: #66bb6a;">
                        <i class="fas fa-arrow-up"></i> Haz clic en "Agregar Producto" para comenzar
                    </p>
                </div>
                `}
                <div style="margin-top: 10px; padding: 8px 12px; background: rgba(76, 175, 80, 0.1); border-radius: 6px; border-left: 3px solid #66bb6a;">
                    <div style="font-size: 11px; color: #66bb6a; display: flex; align-items: center; gap: 6px;">
                        <i class="fas fa-info-circle"></i>
                        <span>Total de productos: <strong>${detalleProductos.length}</strong></span>
                    </div>
                </div>
            </div>
            ` : ''}

                <!-- Información adicional -->
                <div style="margin-top: 20px; padding: 12px; background: rgba(110, 120, 255, 0.1); border-radius: 8px; border-left: 4px solid #6e78ff;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                        <i class="fas fa-info-circle" style="color: #6e78ff;"></i>
                        <span style="font-size: 11px; color: #8b94ff; font-weight: 600;">INFORMACIÓN DEL REGISTRO</span>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 11px; color: #b0b3b8;">
                        <div><i class="fas fa-user" style="color: #6e78ff; margin-right: 5px;"></i>Usuario: ${nota.NombreUsuario || 'N/A'}</div>
                        <div><i class="fas fa-clock" style="color: #6e78ff; margin-right: 5px;"></i>Fecha: ${formatearFechaHora(nota.FechaHoraRegistro)}</div>
                    </div>
                </div>
            </div>
        `,
        width: '700px',
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-save"></i> Guardar Cambios',
        cancelButtonText: '<i class="fas fa-times"></i> Cancelar',
        confirmButtonColor: '#6e78ff',
        cancelButtonColor: '#6c757d',
        background: '#1e2132',
        color: '#e4e6eb',
        customClass: {
            popup: 'swal-dark-popup',
            confirmButton: 'swal-btn-confirm',
            cancelButton: 'swal-btn-cancel'
        },
        didOpen: () => {
            // Hacer que el input de serie convierta a mayúsculas automáticamente
            const serieInput = document.getElementById('swal-serie');
            serieInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.toUpperCase();
            });
            
            // Agregar efectos de focus
            const inputs = document.querySelectorAll('.swal2-input, .swal2-textarea');
            inputs.forEach(input => {
                input.addEventListener('focus', function() {
                    this.style.borderColor = '#6e78ff';
                    this.style.boxShadow = '0 0 0 3px rgba(110, 120, 255, 0.1)';
                });
                input.addEventListener('blur', function() {
                    this.style.borderColor = '#2d3142';
                    this.style.boxShadow = 'none';
                });
            });
            
            // Agregar efectos a los inputs de cantidad de productos
            const cantidadInputs = document.querySelectorAll('.cantidad-producto');
            cantidadInputs.forEach(input => {
                input.addEventListener('focus', function() {
                    this.style.borderColor = '#66bb6a';
                    this.style.boxShadow = '0 0 0 3px rgba(76, 175, 80, 0.15)';
                    this.style.transform = 'scale(1.05)';
                });
                input.addEventListener('blur', function() {
                    this.style.borderColor = '#2d3142';
                    this.style.boxShadow = 'none';
                    this.style.transform = 'scale(1)';
                });
                
                // Validar que solo sean números enteros positivos
                input.addEventListener('input', function() {
                    if (this.value < 0) this.value = 0;
                    this.value = Math.floor(this.value); // Solo enteros
                });
            });
        },
        preConfirm: () => {
            const serie = document.getElementById('swal-serie').value.trim();
            const numero = document.getElementById('swal-numero').value.trim();
            const monto = document.getElementById('swal-monto').value;
            const fecha = document.getElementById('swal-fecha').value;
            const observaciones = document.getElementById('swal-observaciones').value.trim();
            
            // Validaciones
            if (!serie) {
                Swal.showValidationMessage('La serie es requerida');
                return false;
            }
            
            if (!numero) {
                Swal.showValidationMessage('El número es requerido');
                return false;
            }
            
            if (!monto || parseFloat(monto) <= 0) {
                Swal.showValidationMessage('El monto debe ser mayor a 0');
                return false;
            }
            
            if (!fecha) {
                Swal.showValidationMessage('La fecha es requerida');
                return false;
            }
            
            // Capturar cantidades de productos si es por mercadería
            const productosActualizados = [];
            if (nota.IdConcepto == 1) {
                const cantidadInputs = document.querySelectorAll('.cantidad-producto');
                cantidadInputs.forEach(input => {
                    const cantidad = parseInt(input.value) || 0;
                    if (cantidad < 0) {
                        Swal.showValidationMessage('Las cantidades no pueden ser negativas');
                        return false;
                    }
                    productosActualizados.push({
                        upc: input.dataset.upc,
                        cantidad: cantidad,
                        cantidadOriginal: parseInt(detalleProductos[input.dataset.index].Cantidad)
                    });
                });
            }
            
            return {
                serie: serie.toUpperCase(),
                numero: parseInt(numero),
                monto: parseFloat(monto),
                fecha: fecha,
                observaciones: observaciones,
                productos: productosActualizados
            };
        }
    });
    
    if (formValues) {
        // Confirmar actualización
        const confirmacion = await Swal.fire({
            title: '¿Confirmar cambios?',
            html: `
                <div style="text-align: left; padding: 10px;">
                    <p style="color: #b0b3b8; margin-bottom: 15px;">Se actualizará la nota de crédito con los siguientes datos:</p>
                    <div style="background: #23273a; padding: 15px; border-radius: 10px; border: 1px solid #2d3142;">
                        <div style="margin-bottom: 10px; color: #e4e6eb;">
                            <strong style="color: #8b94ff;">Serie:</strong> ${formValues.serie}
                        </div>
                        <div style="margin-bottom: 10px; color: #e4e6eb;">
                            <strong style="color: #8b94ff;">Número:</strong> ${formValues.numero}
                        </div>
                        <div style="margin-bottom: 10px; color: #e4e6eb;">
                            <strong style="color: #8b94ff;">Monto:</strong> ${formatearMoneda(formValues.monto)}
                        </div>
                        <div style="margin-bottom: 10px; color: #e4e6eb;">
                            <strong style="color: #8b94ff;">Fecha:</strong> ${formatearFecha(formValues.fecha)}
                        </div>
                    </div>
                </div>
            `,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#6e78ff',
            cancelButtonColor: '#6c757d',
            confirmButtonText: '<i class="fas fa-check"></i> Sí, actualizar',
            cancelButtonText: '<i class="fas fa-times"></i> Cancelar',
            background: '#1e2132',
            color: '#e4e6eb'
        });
        
        if (confirmacion.isConfirmed) {
            await actualizarNotaCredito(nota.IdNotaCreditoProveedores, formValues);
        }
    }
}


// ============================================
// ACTUALIZAR EN BASE DE DATOS
// ============================================
async function actualizarNotaCredito(idNotaCredito, datos) {
    showLoading(true);
    
    try {
        const connection = await odbc.connect(conexionfacturas);
        
        // Obtener los datos actuales de la nota de crédito ANTES de actualizar
        const notaActual = notasCreditoData.find(n => n.IdNotaCreditoProveedores === idNotaCredito);
        
        if (!notaActual) {
            throw new Error('No se encontró la nota de crédito en los datos cargados');
        }
        
        // Obtener información del usuario actual
        const idUsuario = localStorage.getItem('userId') || 0;
        const nombreUsuario = localStorage.getItem('userName') || 'Usuario';
        
        // Array para almacenar los cambios detectados
        const cambios = [];
        
        // Detectar cambios y preparar registros para el historial
        
        // Comparar Serie (string)
        const serieActual = (notaActual.Serie || '').trim();
        const serieNueva = (datos.serie || '').trim();
        if (serieActual !== serieNueva) {
            cambios.push({
                tipo: 'Serie',
                anterior: serieActual || 'N/A',
                nuevo: serieNueva
            });
        }
        
        // Comparar Número (entero) - asegurar que ambos sean números
        const numeroActual = parseInt(notaActual.Numero);
        const numeroNuevo = parseInt(datos.numero);
        if (numeroActual !== numeroNuevo) {
            cambios.push({
                tipo: 'Numero',
                anterior: numeroActual.toString(),
                nuevo: numeroNuevo.toString()
            });
        }
        
        // Comparar Monto (decimal con 2 decimales)
        const montoActual = parseFloat(notaActual.Monto).toFixed(2);
        const montoNuevo = parseFloat(datos.monto).toFixed(2);
        if (montoActual !== montoNuevo) {
            cambios.push({
                tipo: 'Monto',
                anterior: montoActual,
                nuevo: montoNuevo
            });
        }
        
        // Comparar Fecha (normalizar a formato YYYY-MM-DD)
        const fechaActual = notaActual.FechaNotaCredito.split('T')[0]; // Solo la parte de fecha
        const fechaNueva = datos.fecha;
        if (fechaActual !== fechaNueva) {
            cambios.push({
                tipo: 'FechaNotaCredito',
                anterior: fechaActual,
                nuevo: fechaNueva
            });
        }
        
        // Comparar Observaciones (normalizar strings)
        const obsActual = (notaActual.Observaciones || '').trim();
        const obsNueva = (datos.observaciones || '').trim();
        if (obsActual !== obsNueva) {
            cambios.push({
                tipo: 'Observaciones',
                anterior: obsActual || 'Sin observaciones',
                nuevo: obsNueva || 'Sin observaciones'
            });
        }
        
        // Detectar cambios en cantidades de productos (si aplica)
        let cambiosProductos = [];
        if (datos.productos && datos.productos.length > 0) {
            datos.productos.forEach(producto => {
                const cantidadActual = parseInt(producto.cantidadOriginal);
                const cantidadNueva = parseInt(producto.cantidad);
                
                if (cantidadActual !== cantidadNueva) {
                    cambiosProductos.push({
                        upc: producto.upc,
                        cantidadAnterior: cantidadActual,
                        cantidadNueva: cantidadNueva
                    });
                    
                    cambios.push({
                        tipo: `Cantidad Producto (UPC: ${producto.upc})`,
                        anterior: cantidadActual.toString(),
                        nuevo: cantidadNueva.toString()
                    });
                }
            });
        }
        
        // Si no hay cambios, no hacer nada
        if (cambios.length === 0) {
            await connection.close();
            showToast('info', 'No se detectaron cambios en la nota de crédito');
            showLoading(false);
            return;
        }
        
        // Actualizar la nota de crédito
        const queryUpdate = `
            UPDATE NCTProveedores 
            SET Serie = ?,
                Numero = ?,
                Monto = ?, 
                FechaNotaCredito = ?, 
                Observaciones = ?
            WHERE IdNotaCreditoProveedores = ?
        `;
        
        await connection.query(queryUpdate, [
            datos.serie,
            datos.numero,
            datos.monto,
            datos.fecha,
            datos.observaciones,
            idNotaCredito
        ]);
        
        // Actualizar cantidades de productos si hay cambios
        if (cambiosProductos.length > 0) {
            const queryUpdateProducto = `
                UPDATE NCTProveedoresDetalle 
                SET Cantidad = ?
                WHERE IdNTCProveedor = ? AND Upc = ?
            `;
            
            for (const producto of cambiosProductos) {
                await connection.query(queryUpdateProducto, [
                    producto.cantidadNueva,
                    idNotaCredito,
                    producto.upc
                ]);
            }
        }
        
        // Registrar cada cambio en el historial
        const queryHistorial = `
            INSERT INTO CambiosNotasCreditoHistorial 
            (IdNotaCredito, TipoCambio, ValorAnterior, ValorNuevo, IdUsuario, NombreUsuario)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        
        for (const cambio of cambios) {
            await connection.query(queryHistorial, [
                idNotaCredito,
                cambio.tipo,
                cambio.anterior,
                cambio.nuevo,
                idUsuario,
                nombreUsuario
            ]);
        }
        
        await connection.close();
        
        // Mostrar resumen de cambios realizados
        let htmlCambios = '<div style="text-align: left; max-height: 200px; overflow-y: auto;">';
        cambios.forEach(cambio => {
            // Determinar ícono según el tipo de cambio
            let icono = 'fa-edit';
            if (cambio.tipo.includes('Cantidad Producto')) {
                icono = 'fa-box';
            } else if (cambio.tipo === 'Monto') {
                icono = 'fa-dollar-sign';
            } else if (cambio.tipo === 'FechaNotaCredito') {
                icono = 'fa-calendar';
            }
            
            htmlCambios += `
                <div style="padding: 8px; margin-bottom: 6px; background: rgba(110, 120, 255, 0.1); border-radius: 6px; border-left: 3px solid #6e78ff;">
                    <div style="font-size: 11px; color: #8b94ff; font-weight: 600; margin-bottom: 3px; display: flex; align-items: center; gap: 6px;">
                        <i class="fas ${icono}"></i>
                        <span>${cambio.tipo}</span>
                    </div>
                    <div style="font-size: 12px; color: #b0b3b8;">
                        <span style="color: #ff7985;">${cambio.anterior}</span>
                        <i class="fas fa-arrow-right" style="margin: 0 6px; font-size: 10px;"></i>
                        <span style="color: #66bb6a;">${cambio.nuevo}</span>
                    </div>
                </div>
            `;
        });
        htmlCambios += '</div>';
        
        Swal.fire({
            icon: 'success',
            title: '¡Actualizado!',
            html: `
                <div style="padding: 10px;">
                    <p style="color: #b0b3b8; margin-bottom: 15px;">La nota de crédito se actualizó correctamente</p>
                    <div style="margin-bottom: 15px; padding: 10px; background: rgba(76, 175, 80, 0.1); border-radius: 8px; border-left: 4px solid #4caf50;">
                        <div style="font-size: 13px; color: #66bb6a;">
                            <i class="fas fa-check-circle"></i> Serie: ${datos.serie} | Número: ${datos.numero}
                        </div>
                    </div>
                    ${cambiosProductos.length > 0 ? `
                    <div style="margin-bottom: 15px; padding: 10px; background: rgba(76, 175, 80, 0.1); border-radius: 8px; border-left: 4px solid #66bb6a;">
                        <div style="font-size: 12px; color: #66bb6a; display: flex; align-items: center; gap: 6px;">
                            <i class="fas fa-box"></i>
                            <span><strong>${cambiosProductos.length}</strong> producto(s) actualizado(s)</span>
                        </div>
                    </div>
                    ` : ''}
                    <div style="margin-top: 15px;">
                        <div style="font-size: 12px; color: #8b94ff; font-weight: 600; margin-bottom: 10px;">
                            <i class="fas fa-history"></i> Cambios registrados (${cambios.length}):
                        </div>
                        ${htmlCambios}
                    </div>
                </div>
            `,
            confirmButtonColor: '#6e78ff',
            background: '#1e2132',
            color: '#e4e6eb',
            width: '600px',
            showConfirmButton: true
        });
        
        // Refrescar la búsqueda actual
        refrescarBusqueda();
        
    } catch (error) {
        console.error('Error al actualizar nota de crédito:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error al actualizar',
            text: 'No se pudo actualizar la nota de crédito. ' + error.message,
            confirmButtonColor: '#6e78ff',
            background: '#1e2132',
            color: '#e4e6eb'
        });
    } finally {
        showLoading(false);
    }
}

// ============================================
// REFRESCAR BÚSQUEDA ACTUAL
// ============================================
function refrescarBusqueda() {
    switch(currentSearchType) {
        case 'rango':
            buscarPorRango();
            break;
        case 'numero':
            buscarPorNumero();
            break;
        case 'serie':
            buscarPorSerie();
            break;
    }
}

// ============================================
// FUNCIONES AUXILIARES
// ============================================

// Mostrar/ocultar loading
function showLoading(show) {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (show) {
        loadingOverlay.classList.add('active');
    } else {
        loadingOverlay.classList.remove('active');
    }
}

// Toast de notificaciones
function showToast(icon, title) {
    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        background: '#1e2132',
        color: '#e4e6eb',
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer);
            toast.addEventListener('mouseleave', Swal.resumeTimer);
        }
    });
    
    Toast.fire({
        icon: icon,
        title: title
    });
}

// Formatear moneda
function formatearMoneda(monto) {
    return new Intl.NumberFormat('es-GT', {
        style: 'currency',
        currency: 'GTQ',
        minimumFractionDigits: 2
    }).format(monto);
}

// Formatear fecha
function formatearFecha(fecha) {
    if (!fecha) return 'N/A';
    
    const date = new Date(fecha);
    const options = { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit',
        timeZone: 'UTC'
    };
    
    return date.toLocaleDateString('es-GT', options);
}

// Formatear fecha y hora
function formatearFechaHora(fechaHora) {
    if (!fechaHora) return 'N/A';
    
    const date = new Date(fechaHora);
    const options = { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    };
    
    return date.toLocaleString('es-GT', options);
}
async function abrirBusquedaProductos(idNotaCredito) {
    const { value: terminoBusqueda } = await Swal.fire({
        title: '<div style="display: flex; align-items: center; gap: 10px; justify-content: center;"><i class="fas fa-search" style="color: #6e78ff;"></i><span>Buscar Producto</span></div>',
        html: `
            <div style="text-align: left; padding: 10px;">
                <div style="background: #23273a; padding: 15px; border-radius: 10px; border: 1px solid #2d3142; margin-bottom: 15px;">
                    <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; color: #8b94ff; font-size: 12px; font-weight: 600;">
                        <i class="fas fa-box"></i> BUSCAR PRODUCTO
                    </label>
                    <input id="swal-busqueda-producto" class="swal2-input" type="text" 
                           placeholder="Ej: arroz, leche, pan bimbo, coca cola..."
                           style="background: #1a1d29; color: #e4e6eb; border: 2px solid #2d3142; padding: 12px; 
                                  border-radius: 8px; width: 100%; margin: 0; font-size: 14px;">
                    <div style="margin-top: 8px; font-size: 11px; color: #8a8d93;">
                        <i class="fas fa-info-circle"></i> Ingresa palabras clave del producto (puede ser parcial o con espacios)
                    </div>
                </div>
            </div>
        `,
        width: '600px',
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-search"></i> Buscar',
        cancelButtonText: '<i class="fas fa-times"></i> Cancelar',
        confirmButtonColor: '#6e78ff',
        cancelButtonColor: '#6c757d',
        background: '#1e2132',
        color: '#e4e6eb',
        didOpen: () => {
            const input = document.getElementById('swal-busqueda-producto');
            input.focus();
            
            // Buscar al presionar Enter
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    Swal.clickConfirm();
                }
            });
            
            // Efectos de focus
            input.addEventListener('focus', function() {
                this.style.borderColor = '#6e78ff';
                this.style.boxShadow = '0 0 0 3px rgba(110, 120, 255, 0.1)';
            });
            input.addEventListener('blur', function() {
                this.style.borderColor = '#2d3142';
                this.style.boxShadow = 'none';
            });
        },
        preConfirm: () => {
            const busqueda = document.getElementById('swal-busqueda-producto').value.trim();
            if (!busqueda) {
                Swal.showValidationMessage('Por favor ingresa un término de búsqueda');
                return false;
            }
            return busqueda;
        }
    });
    
    if (terminoBusqueda) {
        await buscarProductos(terminoBusqueda, idNotaCredito);
    }
}

// Buscar productos en la base de datos
async function buscarProductos(termino, idNotaCredito) {
    showLoading(true);
    
    try {
        const connection = await odbc.connect('DSN=local');
        
        // Dividir el término de búsqueda en palabras individuales
        const palabras = termino.trim().split(/\s+/).filter(p => p.length > 0);
        
        // Construir condiciones LIKE para cada palabra
        let condiciones = palabras.map(() => 'productos.DescLarga LIKE ?').join(' AND ');
        
        // Parámetros con % alrededor de cada palabra
        const parametros = palabras.map(palabra => `%${palabra}%`);
        
        const query = `
            SELECT 
                productos.Upc,
                productos.DescLarga,
                productos.Costo,
                productos.Precio
            FROM productos
            WHERE ${condiciones}
            ORDER BY productos.DescLarga
        `;
        
        const resultados = await connection.query(query, parametros);
        await connection.close();
        
        if (resultados.length === 0) {
            Swal.fire({
                icon: 'info',
                title: 'Sin resultados',
                text: `No se encontraron productos que coincidan con "${termino}"`,
                confirmButtonColor: '#6e78ff',
                background: '#1e2132',
                color: '#e4e6eb'
            }).then(() => {
                // Volver a abrir búsqueda
                abrirBusquedaProductos(idNotaCredito);
            });
        } else {
            mostrarResultadosProductos(resultados, idNotaCredito);
        }
        
    } catch (error) {
        console.error('Error al buscar productos:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error de búsqueda',
            text: 'No se pudo buscar en la base de datos de productos.',
            confirmButtonColor: '#6e78ff',
            background: '#1e2132',
            color: '#e4e6eb'
        });
    } finally {
        showLoading(false);
    }
}

// Mostrar resultados de búsqueda de productos
async function mostrarResultadosProductos(productos, idNotaCredito) {
    const { value: productoSeleccionado } = await Swal.fire({
        title: '<div style="display: flex; align-items: center; gap: 10px; justify-content: center;"><i class="fas fa-list" style="color: #66bb6a;"></i><span>Resultados de Búsqueda</span></div>',
        html: `
            <div style="text-align: left; padding: 10px; max-height: 60vh; overflow-y: auto;">
                <div style="margin-bottom: 15px; padding: 10px; background: rgba(110, 120, 255, 0.1); border-radius: 8px; border-left: 4px solid #6e78ff;">
                    <div style="font-size: 12px; color: #8b94ff;">
                        <i class="fas fa-info-circle"></i> Se encontraron <strong>${productos.length}</strong> producto(s). Selecciona uno para agregar.
                    </div>
                </div>
                
                <div style="background: #1a1d29; border-radius: 8px; overflow: hidden; border: 1px solid #2d3142;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                        <thead>
                            <tr style="background: linear-gradient(135deg, #2d3142, #23273a);">
                                <th style="padding: 10px; text-align: left; color: #8b94ff; font-weight: 600; font-size: 11px; border-bottom: 2px solid #2d3142; width: 50px;">SEL.</th>
                                <th style="padding: 10px; text-align: left; color: #8b94ff; font-weight: 600; font-size: 11px; border-bottom: 2px solid #2d3142;">UPC</th>
                                <th style="padding: 10px; text-align: left; color: #8b94ff; font-weight: 600; font-size: 11px; border-bottom: 2px solid #2d3142;">DESCRIPCIÓN</th>
                                <th style="padding: 10px; text-align: center; color: #66bb6a; font-weight: 600; font-size: 11px; border-bottom: 2px solid #2d3142; width: 100px;">COSTO</th>
                                <th style="padding: 10px; text-align: center; color: #66bb6a; font-weight: 600; font-size: 11px; border-bottom: 2px solid #2d3142; width: 100px;">PRECIO</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${productos.map((producto, index) => `
                                <tr class="producto-row" data-index="${index}" style="border-bottom: 1px solid #2d3142; cursor: pointer; transition: all 0.2s ease;">
                                    <td style="padding: 10px; text-align: center;">
                                        <input type="radio" name="producto-sel" value="${index}" class="producto-radio" 
                                               style="cursor: pointer; width: 16px; height: 16px; accent-color: #6e78ff;">
                                    </td>
                                    <td style="padding: 10px; color: #b0b3b8;">
                                        <div style="display: flex; align-items: center; gap: 6px;">
                                            <i class="fas fa-barcode" style="color: #6e78ff; font-size: 10px;"></i>
                                            <span>${producto.Upc || 'N/A'}</span>
                                        </div>
                                    </td>
                                    <td style="padding: 10px; color: #e4e6eb; font-weight: 500;">${producto.DescLarga}</td>
                                    <td style="padding: 10px; text-align: center; color: #66bb6a; font-weight: 600;">Q ${parseFloat(producto.Costo || 0).toFixed(2)}</td>
                                    <td style="padding: 10px; text-align: center; color: #66bb6a; font-weight: 600;">Q ${parseFloat(producto.Precio || 0).toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `,
        width: '900px',
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: '<i class="fas fa-arrow-right"></i> Continuar',
        denyButtonText: '<i class="fas fa-search"></i> Nueva Búsqueda',
        cancelButtonText: '<i class="fas fa-times"></i> Cancelar',
        confirmButtonColor: '#6e78ff',
        denyButtonColor: '#ff9800',
        cancelButtonColor: '#6c757d',
        background: '#1e2132',
        color: '#e4e6eb',
        didOpen: () => {
            // Hacer que al hacer click en la fila también seleccione el radio
            const rows = document.querySelectorAll('.producto-row');
            rows.forEach(row => {
                row.addEventListener('click', function(e) {
                    if (e.target.type !== 'radio') {
                        const radio = this.querySelector('.producto-radio');
                        radio.checked = true;
                    }
                    
                    // Resaltar fila seleccionada
                    rows.forEach(r => r.style.background = 'transparent');
                    this.style.background = 'rgba(110, 120, 255, 0.15)';
                });
                
                // Hover effect
                row.addEventListener('mouseenter', function() {
                    if (!this.querySelector('.producto-radio').checked) {
                        this.style.background = 'rgba(110, 120, 255, 0.05)';
                    }
                });
                
                row.addEventListener('mouseleave', function() {
                    if (!this.querySelector('.producto-radio').checked) {
                        this.style.background = 'transparent';
                    }
                });
            });
        },
        preConfirm: () => {
            const seleccionado = document.querySelector('input[name="producto-sel"]:checked');
            if (!seleccionado) {
                Swal.showValidationMessage('Por favor selecciona un producto');
                return false;
            }
            return parseInt(seleccionado.value);
        }
    });
    
    if (productoSeleccionado !== undefined) {
        if (productoSeleccionado === false) {
            // Usuario presionó "Nueva Búsqueda"
            return;
        }
        const producto = productos[productoSeleccionado];
        await solicitarCantidadProducto(producto, idNotaCredito);
    } else {
        // Si presionó "Nueva Búsqueda" (deny button)
        const result = await Swal.getQueueStep();
        if (result === 1) { // deny button index
            abrirBusquedaProductos(idNotaCredito);
        }
    }
}

// Solicitar cantidad del producto
async function solicitarCantidadProducto(producto, idNotaCredito) {
    const { value: cantidad } = await Swal.fire({
        title: '<div style="display: flex; align-items: center; gap: 10px; justify-content: center;"><i class="fas fa-calculator" style="color: #66bb6a;"></i><span>Ingresar Cantidad</span></div>',
        html: `
            <div style="text-align: left; padding: 10px;">
                <!-- Información del producto -->
                <div style="background: linear-gradient(135deg, #6e78ff, #5661e6); padding: 15px; border-radius: 10px; margin-bottom: 20px;">
                    <div style="font-size: 12px; color: rgba(255,255,255,0.8); margin-bottom: 8px;">Producto Seleccionado</div>
                    <div style="font-size: 16px; font-weight: 700; color: white; margin-bottom: 8px;">${producto.DescLarga}</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px;">
                        <div style="background: rgba(255,255,255,0.15); padding: 8px; border-radius: 6px;">
                            <div style="font-size: 10px; color: rgba(255,255,255,0.7);">UPC</div>
                            <div style="font-size: 13px; font-weight: 600; color: white;">${producto.Upc || 'N/A'}</div>
                        </div>
                        <div style="background: rgba(255,255,255,0.15); padding: 8px; border-radius: 6px;">
                            <div style="font-size: 10px; color: rgba(255,255,255,0.7);">Costo</div>
                            <div style="font-size: 13px; font-weight: 600; color: white;">Q ${parseFloat(producto.Costo || 0).toFixed(2)}</div>
                        </div>
                    </div>
                </div>
                
                <!-- Input de cantidad -->
                <div style="background: #23273a; padding: 15px; border-radius: 10px; border: 1px solid #2d3142;">
                    <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; color: #66bb6a; font-size: 12px; font-weight: 600;">
                        <i class="fas fa-hashtag"></i> CANTIDAD
                    </label>
                    <input id="swal-cantidad" class="swal2-input" type="number" min="1" step="1" value="1"
                           placeholder="Ingrese cantidad"
                           style="background: #1a1d29; color: #66bb6a; border: 2px solid #2d3142; padding: 12px; 
                                  border-radius: 8px; width: 100%; margin: 0; font-size: 18px; font-weight: 700; text-align: center;">
                    <div style="margin-top: 8px; font-size: 11px; color: #8a8d93; text-align: center;">
                        <i class="fas fa-info-circle"></i> Ingresa la cantidad de unidades para esta nota de crédito
                    </div>
                </div>
            </div>
        `,
        width: '500px',
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-plus"></i> Agregar Producto',
        cancelButtonText: '<i class="fas fa-times"></i> Cancelar',
        confirmButtonColor: '#66bb6a',
        cancelButtonColor: '#6c757d',
        background: '#1e2132',
        color: '#e4e6eb',
        didOpen: () => {
            const input = document.getElementById('swal-cantidad');
            input.focus();
            input.select();
            
            // Efectos de focus
            input.addEventListener('focus', function() {
                this.style.borderColor = '#66bb6a';
                this.style.boxShadow = '0 0 0 3px rgba(76, 175, 80, 0.15)';
            });
            input.addEventListener('blur', function() {
                this.style.borderColor = '#2d3142';
                this.style.boxShadow = 'none';
            });
            
            // Solo números enteros positivos
            input.addEventListener('input', function() {
                if (this.value < 1) this.value = 1;
                this.value = Math.floor(this.value);
            });
        },
        preConfirm: () => {
            const cant = document.getElementById('swal-cantidad').value;
            if (!cant || parseInt(cant) < 1) {
                Swal.showValidationMessage('La cantidad debe ser al menos 1');
                return false;
            }
            return parseInt(cant);
        }
    });
    
    if (cantidad) {
        await guardarProductoEnDetalle(idNotaCredito, producto, cantidad);
    }
}

// Guardar producto en NCTProveedoresDetalle
async function guardarProductoEnDetalle(idNotaCredito, producto, cantidad) {
    showLoading(true);
    
    try {
        const connection = await odbc.connect(conexionfacturas);
        
        // Verificar si el producto ya existe en el detalle
        const queryVerificar = `
            SELECT COUNT(*) as existe 
            FROM NCTProveedoresDetalle 
            WHERE IdNTCProveedor = ? AND Upc = ?
        `;
        const verificacion = await connection.query(queryVerificar, [idNotaCredito, producto.Upc]);
        
        if (verificacion[0].existe > 0) {
            // Producto ya existe, preguntar si desea actualizar la cantidad
            await connection.close();
            
            const { isConfirmed } = await Swal.fire({
                title: 'Producto ya existe',
                html: `
                    <div style="padding: 10px; text-align: left;">
                        <p style="color: #b0b3b8; margin-bottom: 10px;">Este producto ya está agregado a la nota de crédito.</p>
                        <div style="background: #23273a; padding: 12px; border-radius: 8px; border: 1px solid #2d3142;">
                            <div style="font-weight: 600; color: #e4e6eb; margin-bottom: 4px;">${producto.DescLarga}</div>
                            <div style="font-size: 12px; color: #8b94ff;">UPC: ${producto.Upc}</div>
                        </div>
                        <p style="color: #ff9800; margin-top: 15px; font-size: 13px;">
                            <i class="fas fa-exclamation-triangle"></i> ¿Deseas actualizar la cantidad con el nuevo valor de <strong>${cantidad}</strong>?
                        </p>
                    </div>
                `,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: '<i class="fas fa-sync"></i> Sí, actualizar',
                cancelButtonText: '<i class="fas fa-times"></i> No, cancelar',
                confirmButtonColor: '#ff9800',
                cancelButtonColor: '#6c757d',
                background: '#1e2132',
                color: '#e4e6eb'
            });
            
            if (!isConfirmed) {
                showLoading(false);
                return;
            }
            
            // Actualizar cantidad
            const connectionUpdate = await odbc.connect(conexionfacturas);
            const queryUpdate = `
                UPDATE NCTProveedoresDetalle 
                SET Cantidad = ?
                WHERE IdNTCProveedor = ? AND Upc = ?
            `;
            await connectionUpdate.query(queryUpdate, [cantidad.toString(), idNotaCredito, producto.Upc]);
            await connectionUpdate.close();
            
            Swal.fire({
                icon: 'success',
                title: '¡Cantidad actualizada!',
                html: `
                    <div style="padding: 10px;">
                        <p style="color: #66bb6a; font-size: 14px;">
                            <i class="fas fa-check-circle"></i> Se actualizó la cantidad a <strong>${cantidad}</strong> unidades
                        </p>
                    </div>
                `,
                timer: 2000,
                showConfirmButton: false,
                background: '#1e2132',
                color: '#e4e6eb'
            });
            
        } else {
            // Insertar nuevo producto
            const queryInsert = `
                INSERT INTO NCTProveedoresDetalle (IdNTCProveedor, Upc, Descripcion, Cantidad)
                VALUES (?, ?, ?, ?)
            `;
            
            await connection.query(queryInsert, [
                idNotaCredito,
                producto.Upc,
                producto.DescLarga,
                cantidad.toString()
            ]);
            
            await connection.close();
            
            Swal.fire({
                icon: 'success',
                title: '¡Producto agregado!',
                html: `
                    <div style="padding: 10px; text-align: left;">
                        <div style="background: linear-gradient(135deg, #4caf50, #66bb6a); padding: 15px; border-radius: 10px; margin-bottom: 15px;">
                            <div style="font-size: 12px; color: rgba(255,255,255,0.8); margin-bottom: 4px;">Producto agregado exitosamente</div>
                            <div style="font-size: 16px; font-weight: 700; color: white;">${producto.DescLarga}</div>
                        </div>
                        <div style="background: #23273a; padding: 12px; border-radius: 8px; border: 1px solid #2d3142;">
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12px;">
                                <div>
                                    <span style="color: #8b94ff;">UPC:</span>
                                    <span style="color: #e4e6eb; margin-left: 5px; font-weight: 600;">${producto.Upc}</span>
                                </div>
                                <div>
                                    <span style="color: #8b94ff;">Cantidad:</span>
                                    <span style="color: #66bb6a; margin-left: 5px; font-weight: 700;">${cantidad}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `,
                timer: 2500,
                showConfirmButton: false,
                background: '#1e2132',
                color: '#e4e6eb'
            });
        }
        
        // Preguntar si desea agregar más productos
        const { isConfirmed } = await Swal.fire({
            title: '¿Agregar más productos?',
            text: '¿Deseas agregar otro producto a esta nota de crédito?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: '<i class="fas fa-plus"></i> Sí, agregar otro',
            cancelButtonText: '<i class="fas fa-check"></i> No, terminar',
            confirmButtonColor: '#6e78ff',
            cancelButtonColor: '#4caf50',
            background: '#1e2132',
            color: '#e4e6eb'
        });
        
        if (isConfirmed) {
            abrirBusquedaProductos(idNotaCredito);
        } else {
            // Refrescar la búsqueda para mostrar los cambios
            refrescarBusqueda();
        }
        
    } catch (error) {
        console.error('Error al guardar producto:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error al guardar',
            text: 'No se pudo guardar el producto en el detalle. ' + error.message,
            confirmButtonColor: '#6e78ff',
            background: '#1e2132',
            color: '#e4e6eb'
        });
    } finally {
        showLoading(false);
    }
}
async function eliminarProductoDetalle(idNotaCredito, upc, descripcion) {
    const { isConfirmed } = await Swal.fire({
        title: '¿Eliminar producto?',
        html: `
            <div style="padding: 10px; text-align: left;">
                <p style="color: #b0b3b8; margin-bottom: 15px;">¿Estás seguro de eliminar este producto del detalle?</p>
                <div style="background: #23273a; padding: 15px; border-radius: 10px; border: 1px solid #2d3142; border-left: 4px solid #ff5e6d;">
                    <div style="font-size: 12px; color: #8b94ff; margin-bottom: 5px;">
                        <i class="fas fa-barcode"></i> UPC: <strong>${upc}</strong>
                    </div>
                    <div style="font-size: 13px; color: #e4e6eb; font-weight: 600;">
                        ${descripcion}
                    </div>
                </div>
                <div style="margin-top: 15px; padding: 10px; background: rgba(255, 94, 109, 0.1); border-radius: 8px; border-left: 4px solid #ff5e6d;">
                    <div style="font-size: 11px; color: #ff7985;">
                        <i class="fas fa-exclamation-triangle"></i> Esta acción será registrada en el historial de cambios
                    </div>
                </div>
            </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-trash"></i> Sí, eliminar',
        cancelButtonText: '<i class="fas fa-times"></i> Cancelar',
        confirmButtonColor: '#ff5e6d',
        cancelButtonColor: '#6c757d',
        background: '#1e2132',
        color: '#e4e6eb'
    });
    
    if (!isConfirmed) return;
    
    showLoading(true);
    
    try {
        const connection = await odbc.connect(conexionfacturas);
        
        // Obtener la cantidad antes de eliminar (para el historial)
        const queryObtener = `
            SELECT Cantidad 
            FROM NCTProveedoresDetalle 
            WHERE IdNTCProveedor = ? AND Upc = ?
        `;
        const resultadoAntes = await connection.query(queryObtener, [idNotaCredito, upc]);
        
        if (resultadoAntes.length === 0) {
            await connection.close();
            showToast('error', 'No se encontró el producto en el detalle');
            showLoading(false);
            return;
        }
        
        const cantidadAnterior = resultadoAntes[0].Cantidad;
        
        // Eliminar el producto
        const queryEliminar = `
            DELETE FROM NCTProveedoresDetalle 
            WHERE IdNTCProveedor = ? AND Upc = ?
        `;
        await connection.query(queryEliminar, [idNotaCredito, upc]);
        
        // Registrar en el historial
        const idUsuario = localStorage.getItem('userId') || 0;
        const nombreUsuario = localStorage.getItem('userName') || 'Usuario';
        
        const queryHistorial = `
            INSERT INTO CambiosNotasCreditoHistorial 
            (IdNotaCredito, TipoCambio, ValorAnterior, ValorNuevo, IdUsuario, NombreUsuario)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        
        await connection.query(queryHistorial, [
            idNotaCredito,
            `Producto Eliminado (UPC: ${upc})`,
            `${descripcion} - Cantidad: ${cantidadAnterior}`,
            'Producto eliminado del detalle',
            idUsuario,
            nombreUsuario
        ]);
        
        await connection.close();
        
        Swal.fire({
            icon: 'success',
            title: '¡Producto eliminado!',
            html: `
                <div style="padding: 10px; text-align: left;">
                    <div style="background: linear-gradient(135deg, #ff5e6d, #ff7985); padding: 15px; border-radius: 10px; margin-bottom: 15px;">
                        <div style="font-size: 12px; color: rgba(255,255,255,0.8); margin-bottom: 4px;">Producto eliminado del detalle</div>
                        <div style="font-size: 16px; font-weight: 700; color: white;">${descripcion}</div>
                    </div>
                    <div style="background: #23273a; padding: 12px; border-radius: 8px; border: 1px solid #2d3142;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12px;">
                            <div>
                                <span style="color: #8b94ff;">UPC:</span>
                                <span style="color: #e4e6eb; margin-left: 5px; font-weight: 600;">${upc}</span>
                            </div>
                            <div>
                                <span style="color: #8b94ff;">Cantidad era:</span>
                                <span style="color: #ff7985; margin-left: 5px; font-weight: 700;">${cantidadAnterior}</span>
                            </div>
                        </div>
                    </div>
                    <div style="margin-top: 10px; padding: 8px; background: rgba(110, 120, 255, 0.1); border-radius: 6px; border-left: 3px solid #6e78ff;">
                        <div style="font-size: 11px; color: #8b94ff;">
                            <i class="fas fa-history"></i> Cambio registrado en el historial
                        </div>
                    </div>
                </div>
            `,
            timer: 3000,
            showConfirmButton: false,
            background: '#1e2132',
            color: '#e4e6eb'
        });
        
        // Refrescar la búsqueda para mostrar los cambios
        setTimeout(() => {
            refrescarBusqueda();
        }, 3100);
        
    } catch (error) {
        console.error('Error al eliminar producto:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error al eliminar',
            text: 'No se pudo eliminar el producto. ' + error.message,
            confirmButtonColor: '#6e78ff',
            background: '#1e2132',
            color: '#e4e6eb'
        });
    } finally {
        showLoading(false);
    }
}