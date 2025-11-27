const odbc = require('odbc');
const Swal = require('sweetalert2');
const mysql = require('mysql2/promise');

// Variables globales
let currentFactura = null;
let editMode = false;
let selectedMotivo = null;
let razonesDisponibles = [];
let originalValues = {};
let refacturacionMode = false;
let selectedMotivoRefacturacion = null;
let maneraRefacturacion = null;
let serieNumeroNotaCredito = null;
let currentFacturaNotaCredito = null;
let tipoNotaCreditoSeleccionado = null;
let datosNotaCredito = {};
let productosFactura = [];
let productosDevolucion = [];
let productosEnTabla = [];

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    const userName = localStorage.getItem('userName') || 'Usuario';
    document.getElementById('userName').textContent = userName;
    setupEventListeners();
    document.getElementById('searchSerie').focus();
}

function setupEventListeners() {
    document.getElementById('searchSerie').addEventListener('keypress', handleSearchKeyPress);
    document.getElementById('searchNumero').addEventListener('keypress', handleSearchKeyPress);
    document.getElementById('btnClearSearch').addEventListener('click', clearSearch);
    document.getElementById('btnBackToSearch').addEventListener('click', backToSearch);
    
    // Los botones btnModificar, btnRefacturar, btnHabilitar y btnNotaCredito 
    // se crean dinámicamente en displayFacturaDetail, así que no se agregan aquí
    
    document.getElementById('btnCancelarEdicion').addEventListener('click', cancelarEdicion);
    document.getElementById('btnGuardarCambios').addEventListener('click', guardarCambios);
    document.getElementById('closeMotivosModal').addEventListener('click', () => {
        document.getElementById('motivoModal').style.display = 'none';
    });
    document.getElementById('closeProveedorModal').addEventListener('click', () => {
        document.getElementById('proveedorModal').style.display = 'none';
    });
    document.getElementById('btnBuscarProveedor').addEventListener('click', abrirModalProveedor);
    document.getElementById('searchProveedorInput').addEventListener('keypress', handleProveedorSearch);
    
    // Eventos de refacturación
    document.getElementById('closeRefacturacionModal').addEventListener('click', cerrarModalRefacturacion);
    document.getElementById('btnBackPaso1').addEventListener('click', volverPaso1Refacturacion);
    document.getElementById('btnContinuarRefacturacion').addEventListener('click', continuarRefacturacion);

    document.getElementById('closeNotaCreditoModal').addEventListener('click', cerrarModalNotaCredito);
    document.getElementById('btnCancelNotaCredito1').addEventListener('click', cerrarModalNotaCredito);
    document.getElementById('btnNextNotaCredito1').addEventListener('click', continuarPaso2NotaCredito);
    document.getElementById('btnBackNotaCredito2').addEventListener('click', volverPaso1NotaCredito);
    document.getElementById('btnNextNotaCredito2').addEventListener('click', continuarPaso3NotaCredito);
    document.getElementById('btnBackNotaCredito3').addEventListener('click', volverPaso2NotaCredito);
    document.getElementById('btnMercaderia').addEventListener('click', handleMercaderia);
    document.getElementById('btnOtrosConceptos').addEventListener('click', handleOtrosConceptos);

    document.getElementById('btnCancelarNotaMercaderia').addEventListener('click', cancelarNotaMercaderia);
    document.getElementById('btnEditarNotaMercaderia').addEventListener('click', editarNotaMercaderia);
    document.getElementById('btnGuardarMercaderia').addEventListener('click', guardarMercaderia);

    document.getElementById('closeBusquedaProductos').addEventListener('click', cerrarModalBusqueda);
    document.getElementById('btnCerrarBusqueda').addEventListener('click', cerrarModalBusqueda);
    document.getElementById('btnBuscarProducto').addEventListener('click', buscarProductos);
    document.getElementById('inputBusquedaProducto').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') buscarProductos();
    });
    document.getElementById('btnClearSearch').addEventListener('click', limpiarBusqueda);
    document.getElementById('inputBusquedaProducto').addEventListener('input', handleSearchInput);

    // Event listener global para F1
    document.addEventListener('keydown', handleF1Key);
    document.getElementById('btnGuardarMercaderia').style.display = 'flex';
}

// ========================================
// Funciones de Búsqueda
// ========================================
async function handleSearchKeyPress(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        const serie = document.getElementById('searchSerie').value.trim();
        const numero = document.getElementById('searchNumero').value.trim();
        
        if (!serie && !numero) {
            Swal.fire({
                icon: 'warning',
                title: 'Campos vacíos',
                text: 'Por favor ingresa una Serie o un Número para buscar.',
                confirmButtonColor: '#6e78ff'
            });
            return;
        }
        
        await searchFacturas(serie, numero);
    }
}

async function searchFacturas(serie, numero) {
    showLoading(true);
    
    try {
        const connection = await odbc.connect('DSN=facturas');
        
        let query = `
            SELECT
                facturas_compras.Id, 
                facturas_compras.IdProveedor, 
                facturas_compras.NombreProveedor, 
                facturas_compras.NIT,
                facturas_compras.IdRazon, 
                facturas_compras.NombreRazon, 
                facturas_compras.Serie, 
                facturas_compras.Numero, 
                facturas_compras.MontoFactura, 
                facturas_compras.FechaRecepcion, 
                facturas_compras.FechaFactura, 
                facturas_compras.IdSucursalCori, 
                facturas_compras.IdInventory,
                facturas_compras.Estado,
                facturas_compras.Sucursal
            FROM
                facturas_compras
                INNER JOIN
                estado_facturas
                ON 
                    facturas_compras.Estado = estado_facturas.IdEstado
            WHERE 1=1
        `;
        
        const params = [];
        
        if (serie) {
            query += ' AND facturas_compras.Serie = ?';
            params.push(serie);
        }
        
        if (numero) {
            query += ' AND facturas_compras.Numero = ?';
            params.push(numero);
        }
        
        query += ' ORDER BY facturas_compras.FechaFactura DESC';
        
        const results = await connection.query(query, params);
        
        await connection.close();
        
        showLoading(false);
        displayResults(results);
        
    } catch (error) {
        showLoading(false);
        console.error('Error en la búsqueda:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error de búsqueda',
            text: 'No se pudo realizar la búsqueda. Por favor verifica tu conexión e inténtalo nuevamente.',
            confirmButtonColor: '#6e78ff'
        });
    }
}

// ========================================
// Mostrar Resultados
// ========================================
function displayResults(results) {
    const resultsContainer = document.getElementById('resultsContainer');
    const resultsTableBody = document.getElementById('resultsTableBody');
    const resultsEmpty = document.getElementById('resultsEmpty');
    
    resultsTableBody.innerHTML = '';
    
    if (results.length === 0) {
        resultsContainer.style.display = 'block';
        resultsEmpty.style.display = 'block';
        document.querySelector('.results-table-wrapper').style.display = 'none';
        return;
    }
    
    resultsContainer.style.display = 'block';
    resultsEmpty.style.display = 'none';
    document.querySelector('.results-table-wrapper').style.display = 'block';
    
    results.forEach(factura => {
        const row = createResultRow(factura);
        resultsTableBody.appendChild(row);
    });
    
    resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function createResultRow(factura) {
    const row = document.createElement('tr');
    const fechaFactura = formatDate(factura.FechaFactura);
    const monto = formatCurrency(factura.MontoFactura);
    
    // Determinar qué botones mostrar según el estado
    let botonesAccion = '';
    
    if (factura.Estado === 0) {
        // Estado 0: Mostrar Anular, Seleccionar y Nota de Crédito
        botonesAccion = `
            <div class="action-buttons">
                <button class="btn-anular" onclick="anularFactura(${factura.Id})">
                    <i class="fas fa-ban"></i>
                    Anular
                </button>
                <button class="btn-select" onclick="selectFactura(${factura.Id})">
                    <i class="fas fa-arrow-right"></i>
                    Seleccionar
                </button>
                <button class="btn-nota-credito" onclick="registrarNotaCredito(${factura.Id})">
                    <i class="fas fa-file-invoice"></i>
                    Nota de Crédito
                </button>
            </div>
        `;
    } else if (factura.Estado === 3) {
        // Estado 3: Solo mostrar botón Habilitar y Nota de Crédito
        botonesAccion = `
            <div class="action-buttons">
                <button class="btn-habilitar" onclick="habilitarFactura(${factura.Id})">
                    <i class="fas fa-unlock"></i>
                    Habilitar
                </button>
                <button class="btn-nota-credito" onclick="registrarNotaCredito(${factura.Id})">
                    <i class="fas fa-file-invoice"></i>
                    Nota de Crédito
                </button>
            </div>
        `;
    } else {
        // Otros estados: Solo mostrar Nota de Crédito
        botonesAccion = `
            <div class="action-buttons">
                <button class="btn-nota-credito" onclick="registrarNotaCredito(${factura.Id})">
                    <i class="fas fa-file-invoice"></i>
                    Nota de Crédito
                </button>
            </div>
        `;
    }
    
    row.innerHTML = `
        <td>${factura.Serie || '-'}</td>
        <td>${factura.Numero || '-'}</td>
        <td>${factura.NombreProveedor || '-'}</td>
        <td>${factura.NombreRazon || '-'}</td>
        <td>${monto}</td>
        <td>${fechaFactura}</td>
        <td>${factura.Sucursal || '-'}</td>
        <td>${botonesAccion}</td>
    `;
    
    return row;
}

// ========================================
// Seleccionar y Mostrar Detalle
// ========================================
async function selectFactura(facturaId) {
    showLoading(true);
    
    try {
        const connection = await odbc.connect('DSN=facturas');
        
        const query = `
            SELECT
                facturas_compras.Id, 
                facturas_compras.IdProveedor, 
                facturas_compras.NombreProveedor, 
                facturas_compras.NIT,
                facturas_compras.IdRazon, 
                facturas_compras.NombreRazon, 
                facturas_compras.Serie, 
                facturas_compras.Numero, 
                facturas_compras.MontoFactura, 
                facturas_compras.FechaRecepcion, 
                facturas_compras.FechaFactura, 
                facturas_compras.IdSucursalCori, 
                facturas_compras.IdInventory, 
                facturas_compras.Estado,
                facturas_compras.Sucursal
            FROM
                facturas_compras INNER JOIN estado_facturas ON  facturas_compras.Estado = estado_facturas.IdEstado
            WHERE facturas_compras.Id = ?
        `;
        
        const results = await connection.query(query, [facturaId]);
        
        await connection.close();
        
        if (results.length > 0) {
            currentFactura = results[0];
            showLoading(false);
            displayFacturaDetail(currentFactura);
        } else {
            showLoading(false);
            Swal.fire({
                icon: 'error',
                title: 'Factura no encontrada',
                text: 'No se pudo cargar el detalle de la factura.',
                confirmButtonColor: '#6e78ff'
            });
        }
        
    } catch (error) {
        showLoading(false);
        console.error('Error al cargar detalle:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo cargar el detalle de la factura.',
            confirmButtonColor: '#6e78ff'
        });
    }
}

function displayFacturaDetail(factura) {
    document.getElementById('searchSection').style.display = 'none';
    document.getElementById('detailSection').style.display = 'block';
    
    document.getElementById('detailSerie').textContent = factura.Serie || '-';
    document.getElementById('detailNumero').textContent = factura.Numero || '-';
    
    document.getElementById('detailId').textContent = factura.Id || '-';
    document.getElementById('detailSerieValue').textContent = factura.Serie || '-';
    document.getElementById('detailNumeroValue').textContent = factura.Numero || '-';
    document.getElementById('detailMonto').textContent = formatCurrency(factura.MontoFactura);
    document.getElementById('detailFechaFactura').textContent = formatDate(factura.FechaFactura);
    document.getElementById('detailFechaRecepcion').textContent = formatDate(factura.FechaRecepcion);
    
    document.getElementById('detailNombreProveedor').textContent = factura.NombreProveedor || '-';
    document.getElementById('detailNIT').textContent = factura.NIT || '-';
    document.getElementById('detailNombreRazon').textContent = factura.NombreRazon || '-';
    
    document.getElementById('detailSucursal').textContent = factura.Sucursal || '-';
    document.getElementById('detailIdInventory').textContent = factura.IdInventory || '-';
    
    // Mostrar botones según el estado
    mostrarBotonesSegunEstado(factura.Estado);
}

function mostrarBotonesSegunEstado(estado) {
    const normalButtons = document.getElementById('normalModeButtons');
    
    // Limpiar botones existentes
    normalButtons.innerHTML = '';
    
    if (estado == 3) {
        // Estado 3: Solo botón Habilitar y Registrar Nota de Crédito
        normalButtons.innerHTML = `
            <button class="btn-action btn-habilitar" id="btnHabilitar">
                <i class="fas fa-unlock"></i>
                Habilitar
            </button>
            <button class="btn-action btn-nota-credito" id="btnNotaCredito">
                <i class="fas fa-file-invoice"></i>
                Registrar Nota de Crédito
            </button>
        `;
        
        // Agregar event listeners
        document.getElementById('btnHabilitar').addEventListener('click', handleHabilitar);
        document.getElementById('btnNotaCredito').addEventListener('click', handleNotaCredito);
    } else {
        // Estado normal: Botones Modificar y ReFacturar
        normalButtons.innerHTML = `
            <button class="btn-action btn-modify" id="btnModificar">
                <i class="fas fa-edit"></i>
                Modificar
            </button>
            <button class="btn-action btn-refacturar" id="btnRefacturar">
                <i class="fas fa-redo"></i>
                ReFacturar
            </button>
        `;
        
        // Agregar event listeners
        document.getElementById('btnModificar').addEventListener('click', handleModificar);
        document.getElementById('btnRefacturar').addEventListener('click', handleRefacturar);
    }
}

// ========================================
// Funciones de Navegación
// ========================================
function clearSearch() {
    document.getElementById('searchSerie').value = '';
    document.getElementById('searchNumero').value = '';
    document.getElementById('resultsContainer').style.display = 'none';
    document.getElementById('searchSerie').focus();
}

function backToSearch() {
    if (editMode) {
        Swal.fire({
            icon: 'warning',
            title: '¿Descartar cambios?',
            text: 'Hay cambios sin guardar. ¿Deseas descartarlos y volver a la búsqueda?',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#6e78ff',
            confirmButtonText: 'Sí, descartar',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                exitEditMode();
                goBackToSearch();
            }
        });
    } else {
        goBackToSearch();
    }
}

function goBackToSearch() {
    document.getElementById('searchSection').style.display = 'flex';
    document.getElementById('detailSection').style.display = 'none';
    currentFactura = null;
    editMode = false;
    selectedMotivo = null;
}

// ========================================
// Funciones de Modificación
// ========================================
async function handleModificar() {
    if (!currentFactura) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No hay una factura seleccionada.',
            confirmButtonColor: '#6e78ff'
        });
        return;
    }
    
    // Validar que la factura no esté en estado 3
    if (currentFactura.Estado === 3) {
        Swal.fire({
            icon: 'warning',
            title: 'Factura no modificable',
            html: `
                <p>Esta factura está en un estado que no permite modificaciones.</p>
                <p>Debe habilitarla primero desde los resultados de búsqueda.</p>
            `,
            confirmButtonColor: '#6e78ff'
        });
        return;
    }
    
    await cargarMotivosModificacion();
}

async function cargarMotivosModificacion() {
    showLoading(true);
    
    try {
        const connection = await odbc.connect('DSN=facturas');
        
        const query = `
            SELECT
                TiposModificacion_Refacturacion.IdRazonModificacion, 
                TiposModificacion_Refacturacion.RazonModificacion
            FROM
                TiposModificacion_Refacturacion
            WHERE
                TiposModificacion_Refacturacion.Motivo = 2
        `;
        
        const results = await connection.query(query);
        
        await connection.close();
        
        showLoading(false);
        
        if (results.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'No hay motivos disponibles',
                text: 'No se encontraron motivos de modificación configurados.',
                confirmButtonColor: '#6e78ff'
            });
            return;
        }
        
        mostrarModalMotivos(results);
        
    } catch (error) {
        showLoading(false);
        console.error('Error al cargar motivos:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudieron cargar los motivos de modificación.',
            confirmButtonColor: '#6e78ff'
        });
    }
}

function mostrarModalMotivos(motivos) {
    const motivosList = document.getElementById('motivosList');
    motivosList.innerHTML = '';
    
    motivos.forEach(motivo => {
        const motivoItem = document.createElement('div');
        motivoItem.className = 'motivo-item';
        motivoItem.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <span>${motivo.RazonModificacion}</span>
        `;
        
        motivoItem.addEventListener('click', () => {
            seleccionarMotivo(motivo);
        });
        
        motivosList.appendChild(motivoItem);
    });
    
    document.getElementById('motivoModal').style.display = 'flex';
}

async function seleccionarMotivo(motivo) {
    selectedMotivo = motivo;
    document.getElementById('motivoModal').style.display = 'none';
    
    document.getElementById('modificacionCard').style.display = 'block';
    document.getElementById('detailMotivoModificacion').textContent = motivo.RazonModificacion;
    
    await cargarRazonesSociales();
    activarModoEdicion();
}

async function cargarRazonesSociales() {
    showLoading(true);
    
    try {
        const connection = await odbc.connect('DSN=facturas');
        
        const query = `
            SELECT
                razonessociales.Id, 
                razonessociales.NombreRazon
            FROM
                razonessociales
            WHERE
                razonessociales.Estado = 'V'
            ORDER BY razonessociales.NombreRazon
        `;
        
        const results = await connection.query(query);
        
        await connection.close();
        
        showLoading(false);
        
        razonesDisponibles = results;
        
        const selectRazon = document.getElementById('editRazonSocial');
        selectRazon.innerHTML = '<option value="">Seleccione una razón social...</option>';
        
        results.forEach(razon => {
            const option = document.createElement('option');
            option.value = razon.Id;
            option.textContent = razon.NombreRazon;
            
            if (currentFactura.IdRazon == razon.Id) {
                option.selected = true;
            }
            
            selectRazon.appendChild(option);
        });
        
    } catch (error) {
        showLoading(false);
        console.error('Error al cargar razones sociales:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudieron cargar las razones sociales.',
            confirmButtonColor: '#6e78ff'
        });
    }
}

function activarModoEdicion() {
    editMode = true;
    
    originalValues = {
        serie: currentFactura.Serie,
        numero: currentFactura.Numero,
        monto: currentFactura.MontoFactura,
        fechaFactura: currentFactura.FechaFactura,
        idProveedor: currentFactura.IdProveedor,
        nombreProveedor: currentFactura.NombreProveedor,
        nit: currentFactura.NIT,
        idRazon: currentFactura.IdRazon,
        nombreRazon: currentFactura.NombreRazon
    };
    
    document.getElementById('normalModeButtons').style.display = 'none';
    document.getElementById('editModeButtons').style.display = 'flex';
    
    const editIndicators = document.querySelectorAll('.edit-indicator');
    editIndicators.forEach(indicator => {
        indicator.style.display = 'inline';
    });
    
    document.getElementById('detailSerieValue').style.display = 'none';
    document.getElementById('editSerieValue').style.display = 'block';
    document.getElementById('editSerieValue').value = currentFactura.Serie || '';
    
    document.getElementById('detailNumeroValue').style.display = 'none';
    document.getElementById('editNumeroValue').style.display = 'block';
    document.getElementById('editNumeroValue').value = currentFactura.Numero || '';
    
    document.getElementById('detailMonto').style.display = 'none';
    document.getElementById('editMonto').style.display = 'block';
    document.getElementById('editMonto').value = currentFactura.MontoFactura || '';
    
    document.getElementById('detailFechaFactura').style.display = 'none';
    document.getElementById('editFechaFactura').style.display = 'block';
    document.getElementById('editFechaFactura').value = formatDateForInput(currentFactura.FechaFactura);
    
    document.getElementById('detailNombreProveedor').style.display = 'none';
    document.querySelector('.edit-proveedor').style.display = 'block';
    document.getElementById('editIdProveedor').value = currentFactura.IdProveedor;
    document.getElementById('proveedorSelectedNombre').textContent = currentFactura.NombreProveedor;
    document.getElementById('proveedorSelected').style.display = 'flex';
    document.getElementById('btnBuscarProveedor').style.display = 'none';
    
    document.getElementById('detailNombreRazon').style.display = 'none';
    document.getElementById('editRazonSocial').style.display = 'block';
    
    const btnCambiar = document.getElementById('btnCambiarProveedor');
    const newBtnCambiar = btnCambiar.cloneNode(true);
    btnCambiar.parentNode.replaceChild(newBtnCambiar, btnCambiar);
    
    newBtnCambiar.addEventListener('click', () => {
        abrirModalProveedor();
    });
    
    Swal.fire({
        icon: 'info',
        title: 'Modo Edición Activado',
        text: 'Ahora puedes modificar los campos marcados con el ícono de edición.',
        timer: 3000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
    });
}

function cancelarEdicion() {
    Swal.fire({
        icon: 'warning',
        title: '¿Cancelar edición?',
        text: 'Los cambios realizados se perderán.',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6e78ff',
        confirmButtonText: 'Sí, cancelar',
        cancelButtonText: 'No'
    }).then((result) => {
        if (result.isConfirmed) {
            exitEditMode();
            displayFacturaDetail(currentFactura);
        }
    });
}

function exitEditMode() {
    editMode = false;
    selectedMotivo = null;
    
    document.getElementById('normalModeButtons').style.display = 'flex';
    document.getElementById('editModeButtons').style.display = 'none';
    
    const editIndicators = document.querySelectorAll('.edit-indicator');
    editIndicators.forEach(indicator => {
        indicator.style.display = 'none';
    });
    
    document.getElementById('detailSerieValue').style.display = 'block';
    document.getElementById('editSerieValue').style.display = 'none';
    
    document.getElementById('detailNumeroValue').style.display = 'block';
    document.getElementById('editNumeroValue').style.display = 'none';
    
    document.getElementById('detailMonto').style.display = 'block';
    document.getElementById('editMonto').style.display = 'none';
    
    document.getElementById('detailFechaFactura').style.display = 'block';
    document.getElementById('editFechaFactura').style.display = 'none';
    
    document.getElementById('detailNombreProveedor').style.display = 'block';
    document.querySelector('.edit-proveedor').style.display = 'none';
    
    document.getElementById('detailNombreRazon').style.display = 'block';
    document.getElementById('editRazonSocial').style.display = 'none';
    
    document.getElementById('modificacionCard').style.display = 'none';
}

async function guardarCambios() {
    const serie = document.getElementById('editSerieValue').value.trim();
    const numero = document.getElementById('editNumeroValue').value.trim();
    const monto = document.getElementById('editMonto').value.trim();
    const fechaFactura = document.getElementById('editFechaFactura').value;
    const idProveedor = document.getElementById('editIdProveedor').value;
    const idRazon = document.getElementById('editRazonSocial').value;
    
    if (!serie || !numero || !monto || !fechaFactura || !idProveedor || !idRazon) {
        Swal.fire({
            icon: 'warning',
            title: 'Campos incompletos',
            text: 'Por favor completa todos los campos requeridos.',
            confirmButtonColor: '#6e78ff'
        });
        return;
    }
    
    const accion = refacturacionMode ? 'refacturar' : 'modificar';
    const accionTexto = refacturacionMode ? 'refacturará' : 'modificará';
    
    Swal.fire({
        icon: 'question',
        title: `¿Guardar ${accion === 'refacturar' ? 'refacturación' : 'cambios'}?`,
        html: `
            <p>Se ${accionTexto} la factura con los siguientes datos:</p>
            <p><strong>Serie:</strong> ${serie}</p>
            <p><strong>Número:</strong> ${numero}</p>
            <p><strong>Monto:</strong> ${formatCurrency(monto)}</p>
        `,
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#6e78ff',
        confirmButtonText: 'Sí, guardar',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            if (refacturacionMode) {
                guardarRefacturacion(serie, numero, monto, fechaFactura, idProveedor, idRazon);
            } else {
                ejecutarModificacion(serie, numero, monto, fechaFactura, idProveedor, idRazon);
            }
        }
    });
}

async function ejecutarModificacion(serie, numero, monto, fechaFactura, idProveedor, idRazon) {
    showLoading(true);
    
    try {
        const userId = localStorage.getItem('userId');
        const userName = localStorage.getItem('userName');
        
        if (!userId || !userName) {
            throw new Error('Usuario no identificado');
        }
        
        // 1. Obtener credenciales de la sucursal
        const credencialesSucursal = await obtenerCredencialesSucursal(currentFactura.IdSucursalCori);
        
        if (!credencialesSucursal) {
            throw new Error('No se pudieron obtener las credenciales de la sucursal');
        }
        
        // 2. Obtener nombre del proveedor y razón social
        const nombreProveedor = document.getElementById('proveedorSelectedNombre').textContent;
        const selectRazon = document.getElementById('editRazonSocial');
        const nombreRazon = selectRazon.options[selectRazon.selectedIndex].text;
        
        // 3. Detectar cambios
        const cambios = detectarCambios(serie, numero, monto, fechaFactura, idProveedor, nombreProveedor, idRazon, nombreRazon);
        
        if (cambios.length === 0) {
            showLoading(false);
            Swal.fire({
                icon: 'info',
                title: 'Sin cambios',
                text: 'No se detectaron cambios para guardar.',
                confirmButtonColor: '#6e78ff'
            });
            return;
        }
        
        // 4. Actualizar en facturas_compras principal
        await actualizarFacturasComprasPrincipal(serie, numero, monto, fechaFactura, idProveedor, nombreProveedor, idRazon, nombreRazon);
        
        // 5. Actualizar en la sucursal
        await actualizarEnSucursal(credencialesSucursal, serie, numero, monto, fechaFactura, idProveedor, nombreProveedor, idRazon, nombreRazon);
        
        // 6. Registrar historial
        await registrarHistorialCambios(cambios, userId, userName);
        
        showLoading(false);
        
        Swal.fire({
            icon: 'success',
            title: '¡Factura modificada exitosamente!',
            html: `
                <p>Se ha actualizado correctamente:</p>
            `,
            confirmButtonColor: '#6e78ff'
        }).then(() => {
            selectFactura(currentFactura.Id);
            exitEditMode();
        });
        
    } catch (error) {
        showLoading(false);
        console.error('Error al guardar:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error al guardar',
            text: error.message || 'No se pudieron guardar los cambios.',
            confirmButtonColor: '#6e78ff'
        });
    }
}

async function obtenerCredencialesSucursal(idSucursal) {
    try {
        const connection = await mysql.createConnection({
            host: '172.30.1.27',
            database: 'dbsucursales',
            user: 'compras',
            password: 'bode.24451988',
            charset: 'utf8mb4'  // ✅ AGREGAR AQUÍ TAMBIÉN
        });
        
        const [rows] = await connection.execute(
            `SELECT
                sucursales.idSucursal, 
                sucursales.NombreSucursal, 
                sucursales.serverr, 
                sucursales.databasee, 
                sucursales.Uid, 
                sucursales.Pwd
            FROM sucursales
            WHERE sucursales.idSucursal = ?`,
            [idSucursal]
        );
        
        await connection.end();
        
        if (rows.length === 0) {
            throw new Error('Sucursal no encontrada');
        }
        
        return rows[0];
        
    } catch (error) {
        console.error('Error al obtener credenciales:', error);
        throw error;
    }
}

function detectarCambios(serie, numero, monto, fechaFactura, idProveedor, nombreProveedor, idRazon, nombreRazon) {
    const cambios = [];
    
    if (serie !== originalValues.serie) {
        cambios.push({
            IdTipoCambio: 1,
            TipoCambio: 'Serie',
            ValorAnterior: originalValues.serie,
            ValorNuevo: serie
        });
    }
    
    if (numero !== originalValues.numero) {
        cambios.push({
            IdTipoCambio: 2,
            TipoCambio: 'Numero',
            ValorAnterior: originalValues.numero,
            ValorNuevo: numero
        });
    }
    
    if (idRazon != originalValues.idRazon) {
        cambios.push({
            IdTipoCambio: 3,
            TipoCambio: 'Razon Social',
            ValorAnterior: originalValues.nombreRazon,
            ValorNuevo: nombreRazon
        });
    }
    
    if (parseFloat(monto) !== parseFloat(originalValues.monto)) {
        cambios.push({
            IdTipoCambio: 4,
            TipoCambio: 'Monto Facturado',
            ValorAnterior: originalValues.monto.toString(),
            ValorNuevo: monto.toString()
        });
    }
    
    const fechaOriginal = formatDateForInput(originalValues.fechaFactura);
    if (fechaFactura !== fechaOriginal) {
        cambios.push({
            IdTipoCambio: 5,
            TipoCambio: 'Fecha Factura',
            ValorAnterior: formatDate(originalValues.fechaFactura),
            ValorNuevo: formatDate(fechaFactura)
        });
    }
    
    if (idProveedor != originalValues.idProveedor) {
        cambios.push({
            IdTipoCambio: 6,
            TipoCambio: 'Proveedor',
            ValorAnterior: originalValues.nombreProveedor,
            ValorNuevo: nombreProveedor
        });
    }
    
    return cambios;
}

async function actualizarFacturasComprasPrincipal(serie, numero, monto, fechaFactura, idProveedor, nombreProveedor, idRazon, nombreRazon) {
    try {
        const connection = await odbc.connect('DSN=facturas');
        
        const query = `
            UPDATE facturas_compras
            SET
                Serie = ?,
                Numero = ?,
                MontoFactura = ?,
                FechaFactura = ?,
                IdProveedor = ?,
                NombreProveedor = ?,
                IdRazon = ?,
                NombreRazon = ?
            WHERE Id = ?
        `;
        
        await connection.query(query, [
            serie,
            numero,
            parseFloat(monto),
            fechaFactura,
            idProveedor,
            nombreProveedor,
            idRazon,
            nombreRazon,
            currentFactura.Id
        ]);
        
        await connection.close();
        
    } catch (error) {
        console.error('Error al actualizar facturas_compras principal:', error);
        throw new Error('Error al actualizar la base de datos principal');
    }
}

async function actualizarEnSucursal(credenciales, serie, numero, monto, fechaFactura, idProveedor, nombreProveedor, idRazon, nombreRazon) {
    try {
        const connection = await mysql.createConnection({
            host: credenciales.serverr,
            database: credenciales.databasee,
            user: credenciales.Uid,
            password: credenciales.Pwd
        });
        
        // Actualizar inventarios
        const queryInventarios = `
            UPDATE inventarios
            SET
                Serie = ?,
                Numero = ?,
                FechaFactura = ?,
                IdProveedores = ?,
                Proveedor = ?,
                IdRazon = ?,
                NombreRazon = ?
            WHERE idInventarios = ?
        `;
        
        await connection.execute(queryInventarios, [
            serie,
            numero,
            fechaFactura,
            idProveedor,
            nombreProveedor,
            idRazon,
            nombreRazon,
            currentFactura.IdInventory
        ]);
        
        // Actualizar facturas_compras
        const queryFacturas = `
            UPDATE facturas_compras
            SET
                IdProveedor = ?,
                NombreProveedor = ?,
                IdRazon = ?,
                NombreRazon = ?,
                Serie = ?,
                Numero = ?,
                MontoFactura = ?,
                FechaFactura = ?
            WHERE IdInventarios = ?
        `;
        
        await connection.execute(queryFacturas, [
            idProveedor,
            nombreProveedor,
            idRazon,
            nombreRazon,
            serie,
            numero,
            parseFloat(monto),
            fechaFactura,
            currentFactura.IdInventory
        ]);
        
        await connection.end();
        
    } catch (error) {
        console.error('Error al actualizar en sucursal:', error);
        throw new Error('Error al actualizar los datos en la sucursal');
    }
}

async function registrarHistorialCambios(cambios, userId, userName) {
    try {
        const connection = await odbc.connect('DSN=facturas');
        
        const query = `
            INSERT INTO CambiosFacturasHistorial
            (IdTipoCambio, TipoCambio, ValorAnterior, ValorNuevo, IdInventario, IdSucursal, Sucursal, IdFacturasCompras, IdUsuario, NombreUsuario, TipoModificacion, IdRazonModificacion)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        for (const cambio of cambios) {
            await connection.query(query, [
                cambio.IdTipoCambio,
                cambio.TipoCambio,
                cambio.ValorAnterior,
                cambio.ValorNuevo,
                currentFactura.IdInventory,
                currentFactura.IdSucursalCori,
                currentFactura.Sucursal,
                currentFactura.Id,
                userId,
                userName,
                2,
                selectedMotivo.IdRazonModificacion
            ]);
        }
        
        await connection.close();
        
    } catch (error) {
        console.error('Error al registrar historial:', error);
        throw new Error('Error al registrar el historial de cambios');
    }
}

// ========================================
// Funciones de Búsqueda de Proveedor
// ========================================
function abrirModalProveedor() {
    document.getElementById('proveedorModal').style.display = 'flex';
    document.getElementById('searchProveedorInput').value = '';
    document.getElementById('proveedoresResults').style.display = 'none';
    document.getElementById('noProveedoresResults').style.display = 'none';
    document.getElementById('searchProveedorInput').focus();
}

async function handleProveedorSearch(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        const searchTerm = document.getElementById('searchProveedorInput').value.trim();
        
        if (!searchTerm) {
            Swal.fire({
                icon: 'warning',
                title: 'Campo vacío',
                text: 'Por favor escribe un nombre o NIT para buscar.',
                confirmButtonColor: '#6e78ff',
                toast: true,
                position: 'top-end',
                timer: 3000,
                showConfirmButton: false
            });
            return;
        }
        
        await buscarProveedores(searchTerm);
    }
}

async function buscarProveedores(searchTerm) {
    showLoading(true);
    
    try {
        const connection = await odbc.connect('DSN=facturas');
        
        const likeTerm = `%${searchTerm.replace(/\s+/g, '%')}%`;
        
        const query = `
            SELECT
                proveedores_facturas.Id, 
                proveedores_facturas.Nombre, 
                proveedores_facturas.Nit
            FROM
                proveedores_facturas
            WHERE
                proveedores_facturas.Nombre LIKE ? OR
                proveedores_facturas.Nit LIKE ?
            ORDER BY proveedores_facturas.Nombre
            LIMIT 50
        `;
        
        const results = await connection.query(query, [likeTerm, likeTerm]);
        
        await connection.close();
        
        showLoading(false);
        
        mostrarResultadosProveedores(results);
        
    } catch (error) {
        showLoading(false);
        console.error('Error al buscar proveedores:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error de búsqueda',
            text: 'No se pudo buscar proveedores.',
            confirmButtonColor: '#6e78ff'
        });
    }
}

function mostrarResultadosProveedores(proveedores) {
    const resultsDiv = document.getElementById('proveedoresResults');
    const noResultsDiv = document.getElementById('noProveedoresResults');
    const tableBody = document.getElementById('proveedoresTableBody');
    
    tableBody.innerHTML = '';
    
    if (proveedores.length === 0) {
        resultsDiv.style.display = 'none';
        noResultsDiv.style.display = 'block';
        return;
    }
    
    resultsDiv.style.display = 'block';
    noResultsDiv.style.display = 'none';
    
    proveedores.forEach(proveedor => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${proveedor.Nombre}</td>
            <td>${proveedor.Nit || '-'}</td>
            <td>
                <button class="btn-select-provider" onclick="seleccionarProveedor(${proveedor.Id}, '${proveedor.Nombre.replace(/'/g, "\\'")}', '${proveedor.Nit || ''}')">
                    Seleccionar
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function seleccionarProveedor(id, nombre, nit) {
    document.getElementById('editIdProveedor').value = id;
    document.getElementById('proveedorSelectedNombre').textContent = nombre;
    document.getElementById('detailNIT').textContent = nit || '-';
    document.getElementById('proveedorSelected').style.display = 'flex';
    document.getElementById('btnBuscarProveedor').style.display = 'none';
    document.getElementById('proveedorModal').style.display = 'none';
    
    Swal.fire({
        icon: 'success',
        title: 'Proveedor seleccionado',
        text: nombre,
        timer: 2000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
    });
}

// ========================================
// Funciones de ReFacturar
// ========================================
async function handleRefacturar() {
    if (!currentFactura) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No hay una factura seleccionada.',
            confirmButtonColor: '#6e78ff'
        });
        return;
    }
    
    // Validar que la factura no esté en estado 3
    if (currentFactura.Estado === 3) {
        Swal.fire({
            icon: 'warning',
            title: 'Factura no refacturable',
            html: `
                <p>Esta factura está en un estado que no permite refacturación.</p>
                <p>Debe habilitarla primero desde los resultados de búsqueda.</p>
            `,
            confirmButtonColor: '#6e78ff'
        });
        return;
    }
    
    await cargarMotivosRefacturacion();
}

async function cargarMotivosRefacturacion() {
    showLoading(true);
    
    try {
        const connection = await odbc.connect('DSN=facturas');
        
        const query = `
            SELECT
                TiposModificacion_Refacturacion.IdRazonModificacion, 
                TiposModificacion_Refacturacion.RazonModificacion
            FROM
                TiposModificacion_Refacturacion
            WHERE
                TiposModificacion_Refacturacion.Motivo = 1
        `;
        
        const results = await connection.query(query);
        
        await connection.close();
        
        showLoading(false);
        
        if (results.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'No hay motivos disponibles',
                text: 'No se encontraron motivos de refacturación configurados.',
                confirmButtonColor: '#6e78ff'
            });
            return;
        }
        
        mostrarModalMotivosRefacturacion(results);
        
    } catch (error) {
        showLoading(false);
        console.error('Error al cargar motivos de refacturación:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudieron cargar los motivos de refacturación.',
            confirmButtonColor: '#6e78ff'
        });
    }
}

function mostrarModalMotivosRefacturacion(motivos) {
    const motivosList = document.getElementById('motivosRefacturacionList');
    motivosList.innerHTML = '';
    
    motivos.forEach(motivo => {
        const motivoItem = document.createElement('div');
        motivoItem.className = 'motivo-item';
        motivoItem.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <span>${motivo.RazonModificacion}</span>
        `;
        
        motivoItem.addEventListener('click', () => {
            seleccionarMotivoRefacturacion(motivo);
        });
        
        motivosList.appendChild(motivoItem);
    });
    
    document.getElementById('refacturacionModal').style.display = 'flex';
    document.getElementById('refacturacionPaso1').style.display = 'block';
    document.getElementById('refacturacionPaso2').style.display = 'none';
}

function seleccionarMotivoRefacturacion(motivo) {
    selectedMotivoRefacturacion = motivo;
    
    // Mostrar paso 2
    document.querySelector('#refacturacionModal .modal-header h3').textContent = 'Refacturar - Paso 2: Manera de Refacturación';
    document.getElementById('refacturacionPaso1').style.display = 'none';
    document.getElementById('refacturacionPaso2').style.display = 'block';
    
    // Configurar event listeners para las opciones de manera
    const maneraOptions = document.querySelectorAll('.manera-option');
    maneraOptions.forEach(option => {
        option.addEventListener('click', function() {
            // Remover selección previa
            maneraOptions.forEach(opt => opt.classList.remove('selected'));
            
            // Agregar selección actual
            this.classList.add('selected');
            
            const manera = this.getAttribute('data-manera');
            maneraRefacturacion = parseInt(manera);
            
            // Mostrar/ocultar campos de nota de crédito
            if (maneraRefacturacion === 2) {
                document.getElementById('notaCreditoFields').style.display = 'block';
            } else {
                document.getElementById('notaCreditoFields').style.display = 'none';
                document.getElementById('serieNotaCredito').value = '';
                document.getElementById('numeroNotaCredito').value = '';
            }
        });
    });
}

function volverPaso1Refacturacion() {
    document.querySelector('#refacturacionModal .modal-header h3').textContent = 'Refacturar - Paso 1: Seleccionar Motivo';
    document.getElementById('refacturacionPaso1').style.display = 'block';
    document.getElementById('refacturacionPaso2').style.display = 'none';
    
    // Limpiar selección
    const maneraOptions = document.querySelectorAll('.manera-option');
    maneraOptions.forEach(opt => opt.classList.remove('selected'));
    maneraRefacturacion = null;
    document.getElementById('notaCreditoFields').style.display = 'none';
}

function cerrarModalRefacturacion() {
    document.getElementById('refacturacionModal').style.display = 'none';
    selectedMotivoRefacturacion = null;
    maneraRefacturacion = null;
    serieNumeroNotaCredito = null;
}

async function continuarRefacturacion() {
    // Validar que se haya seleccionado una manera
    if (!maneraRefacturacion) {
        Swal.fire({
            icon: 'warning',
            title: 'Selección requerida',
            text: 'Por favor selecciona la manera de refacturación.',
            confirmButtonColor: '#6e78ff'
        });
        return;
    }
    
    // Si es nota de crédito, validar campos
    if (maneraRefacturacion === 2) {
        const serie = document.getElementById('serieNotaCredito').value.trim();
        const numero = document.getElementById('numeroNotaCredito').value.trim();
        
        if (!serie || !numero) {
            Swal.fire({
                icon: 'warning',
                title: 'Campos incompletos',
                text: 'Por favor ingresa la Serie y Número de la Nota de Crédito.',
                confirmButtonColor: '#6e78ff'
            });
            return;
        }
        
        serieNumeroNotaCredito = `${serie}-${numero}`;
    } else {
        serieNumeroNotaCredito = null;
    }
    
    // Cerrar modal
    document.getElementById('refacturacionModal').style.display = 'none';
    
    // Mostrar card de refacturación en el detalle
    document.getElementById('modificacionCard').style.display = 'block';
    const maneraTexto = maneraRefacturacion === 1 ? 'Anulación de Factura' : 'Nota de Crédito';
    let motivoTexto = `${selectedMotivoRefacturacion.RazonModificacion} - ${maneraTexto}`;
    if (serieNumeroNotaCredito) {
        motivoTexto += ` (${serieNumeroNotaCredito})`;
    }
    document.getElementById('detailMotivoModificacion').textContent = motivoTexto;
    
    // Cargar razones sociales
    await cargarRazonesSociales();
    
    // Activar modo refacturación (similar a edición pero limpiando campos)
    activarModoRefacturacion();
}

function activarModoRefacturacion() {
    refacturacionMode = true;
    editMode = true;
    
    // Guardar valores originales
    originalValues = {
        serie: currentFactura.Serie,
        numero: currentFactura.Numero,
        monto: currentFactura.MontoFactura,
        fechaFactura: currentFactura.FechaFactura,
        idProveedor: currentFactura.IdProveedor,
        nombreProveedor: currentFactura.NombreProveedor,
        nit: currentFactura.NIT,
        idRazon: currentFactura.IdRazon,
        nombreRazon: currentFactura.NombreRazon
    };
    
    document.getElementById('normalModeButtons').style.display = 'none';
    document.getElementById('editModeButtons').style.display = 'flex';
    
    const editIndicators = document.querySelectorAll('.edit-indicator');
    editIndicators.forEach(indicator => {
        indicator.style.display = 'inline';
    });
    
    // IMPORTANTE: Limpiar campos para refacturación
    document.getElementById('detailSerieValue').style.display = 'none';
    document.getElementById('editSerieValue').style.display = 'block';
    document.getElementById('editSerieValue').value = ''; // LIMPIAR
    
    document.getElementById('detailNumeroValue').style.display = 'none';
    document.getElementById('editNumeroValue').style.display = 'block';
    document.getElementById('editNumeroValue').value = ''; // LIMPIAR
    
    document.getElementById('detailMonto').style.display = 'none';
    document.getElementById('editMonto').style.display = 'block';
    document.getElementById('editMonto').value = ''; // LIMPIAR
    
    document.getElementById('detailFechaFactura').style.display = 'none';
    document.getElementById('editFechaFactura').style.display = 'block';
    document.getElementById('editFechaFactura').value = ''; // LIMPIAR
    
    // Proveedor - ocultar y mostrar botón de búsqueda
    document.getElementById('detailNombreProveedor').style.display = 'none';
    document.querySelector('.edit-proveedor').style.display = 'block';
    document.getElementById('editIdProveedor').value = '';
    document.getElementById('proveedorSelected').style.display = 'none';
    document.getElementById('btnBuscarProveedor').style.display = 'block'; // MOSTRAR BOTÓN
    
    // Razón Social - limpiar selección
    document.getElementById('detailNombreRazon').style.display = 'none';
    document.getElementById('editRazonSocial').style.display = 'block';
    document.getElementById('editRazonSocial').selectedIndex = 0; // LIMPIAR
    
    Swal.fire({
        icon: 'info',
        title: 'Modo Refacturación Activado',
        text: 'Ingresa los nuevos datos de la factura.',
        timer: 3000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
    });
}

async function guardarRefacturacion(serie, numero, monto, fechaFactura, idProveedor, idRazon) {
    showLoading(true);
    
    try {
        const userId = localStorage.getItem('userId');
        const userName = localStorage.getItem('userName');
        
        if (!userId || !userName) {
            throw new Error('Usuario no identificado');
        }
        
        // 1. Obtener credenciales de la sucursal
        const credencialesSucursal = await obtenerCredencialesSucursal(currentFactura.IdSucursalCori);
        
        if (!credencialesSucursal) {
            throw new Error('No se pudieron obtener las credenciales de la sucursal');
        }
        
        // 2. Obtener nombre del proveedor y razón social
        const nombreProveedor = document.getElementById('proveedorSelectedNombre').textContent;
        const selectRazon = document.getElementById('editRazonSocial');
        const nombreRazon = selectRazon.options[selectRazon.selectedIndex].text;
        
        // 3. Detectar cambios (todos los campos cambiaron en refacturación)
        const cambios = detectarCambiosRefacturacion(serie, numero, monto, fechaFactura, idProveedor, nombreProveedor, idRazon, nombreRazon);
        
        // 4. Actualizar en facturas_compras principal
        await actualizarFacturasComprasPrincipal(serie, numero, monto, fechaFactura, idProveedor, nombreProveedor, idRazon, nombreRazon);
        
        // 5. Actualizar en la sucursal
        await actualizarEnSucursal(credencialesSucursal, serie, numero, monto, fechaFactura, idProveedor, nombreProveedor, idRazon, nombreRazon);
        
        // 6. Registrar historial con TipoModificacion = 1 (Refacturación)
        await registrarHistorialRefacturacion(cambios, userId, userName);
        
        showLoading(false);
        
        Swal.fire({
            icon: 'success',
            title: '¡Factura refacturada exitosamente!',
            html: `
                <p>Se ha actualizado correctamente:</p>
            `,
            confirmButtonColor: '#6e78ff'
        }).then(() => {
            selectFactura(currentFactura.Id);
            exitEditMode();
            refacturacionMode = false;
        });
        
    } catch (error) {
        showLoading(false);
        console.error('Error al refacturar:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error al refacturar',
            text: error.message || 'No se pudieron guardar los cambios.',
            confirmButtonColor: '#6e78ff'
        });
    }
}

function detectarCambiosRefacturacion(serie, numero, monto, fechaFactura, idProveedor, nombreProveedor, idRazon, nombreRazon) {
    // En refacturación, todos los campos son cambios
    const cambios = [];
    
    cambios.push({
        IdTipoCambio: 1,
        TipoCambio: 'Serie',
        ValorAnterior: originalValues.serie,
        ValorNuevo: serie
    });
    
    cambios.push({
        IdTipoCambio: 2,
        TipoCambio: 'Numero',
        ValorAnterior: originalValues.numero,
        ValorNuevo: numero
    });
    
    cambios.push({
        IdTipoCambio: 3,
        TipoCambio: 'Razon Social',
        ValorAnterior: originalValues.nombreRazon,
        ValorNuevo: nombreRazon
    });
    
    cambios.push({
        IdTipoCambio: 4,
        TipoCambio: 'Monto Facturado',
        ValorAnterior: originalValues.monto.toString(),
        ValorNuevo: monto.toString()
    });
    
    cambios.push({
        IdTipoCambio: 5,
        TipoCambio: 'Fecha Factura',
        ValorAnterior: formatDate(originalValues.fechaFactura),
        ValorNuevo: formatDate(fechaFactura)
    });
    
    cambios.push({
        IdTipoCambio: 6,
        TipoCambio: 'Proveedor',
        ValorAnterior: originalValues.nombreProveedor,
        ValorNuevo: nombreProveedor
    });
    
    return cambios;
}

async function registrarHistorialRefacturacion(cambios, userId, userName) {
    try {
        const connection = await odbc.connect('DSN=facturas');
        
        const query = `
            INSERT INTO CambiosFacturasHistorial
            (IdTipoCambio, TipoCambio, ValorAnterior, ValorNuevo, IdInventario, IdSucursal, Sucursal, IdFacturasCompras, IdUsuario, NombreUsuario, TipoModificacion, IdRazonModificacion, ManeraRefacturacion, SerieNumeroNotaCredito)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        for (const cambio of cambios) {
            await connection.query(query, [
                cambio.IdTipoCambio,
                cambio.TipoCambio,
                cambio.ValorAnterior,
                cambio.ValorNuevo,
                currentFactura.IdInventory,
                currentFactura.IdSucursalCori,
                currentFactura.Sucursal,
                currentFactura.Id,
                userId,
                userName,
                1, // TipoModificacion = 1 (Refacturación)
                selectedMotivoRefacturacion.IdRazonModificacion,
                maneraRefacturacion,
                serieNumeroNotaCredito
            ]);
        }
        
        await connection.close();
        
    } catch (error) {
        console.error('Error al registrar historial de refacturación:', error);
        throw new Error('Error al registrar el historial de cambios');
    }
}

// ========================================
// Funciones de Habilitar y Nota de Crédito
// ========================================
async function handleHabilitar() {
    if (!currentFactura) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No hay una factura seleccionada.',
            confirmButtonColor: '#6e78ff'
        });
        return;
    }
    
    Swal.fire({
        icon: 'warning',
        title: '¿Habilitar factura?',
        html: `
            <p>Se habilitará la factura para poder ser modificada:</p>
            <p><strong>Serie:</strong> ${currentFactura.Serie}</p>
            <p><strong>Número:</strong> ${currentFactura.Numero}</p>
            <p><strong>Proveedor:</strong> ${currentFactura.NombreProveedor}</p>
        `,
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#6e78ff',
        confirmButtonText: 'Sí, habilitar',
        cancelButtonText: 'Cancelar'
    }).then(async (result) => {
        if (result.isConfirmed) {
            await ejecutarHabilitacion();
        }
    });
}

async function ejecutarHabilitacion() {
    showLoading(true);
    
    try {
        const userId = localStorage.getItem('userId');
        const userName = localStorage.getItem('userName');
        
        if (!userId || !userName) {
            throw new Error('Usuario no identificado');
        }
        
        // Obtener nombres de estados
        const nombreEstadoAnterior = await obtenerNombreEstado(3);  // Estado Anulado
        const nombreEstadoNuevo = await obtenerNombreEstado(0);     // Estado Activo
        
        const connection = await odbc.connect('DSN=facturas');
        
        // 1. Actualizar el estado a 0 en facturas_compras
        const updateQuery = `
            UPDATE facturas_compras
            SET Estado = 0
            WHERE Id = ?
        `;
        
        await connection.query(updateQuery, [currentFactura.Id]);
        
        // 2. Registrar en historial CON NOMBRES DE ESTADOS
        const historialQuery = `
            INSERT INTO CambiosFacturasHistorial
            (IdTipoCambio, TipoCambio, ValorAnterior, ValorNuevo, IdInventario, IdSucursal, Sucursal, IdFacturasCompras, IdUsuario, NombreUsuario, TipoModificacion, IdRazonModificacion)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        await connection.query(historialQuery, [
            7,                              // IdTipoCambio
            'Estado',                       // TipoCambio
            nombreEstadoAnterior,           // ValorAnterior (Nombre del estado, ej: "Anulado")
            nombreEstadoNuevo,              // ValorNuevo (Nombre del estado, ej: "Activo")
            currentFactura.IdInventory,
            currentFactura.IdSucursalCori,
            currentFactura.Sucursal,
            currentFactura.Id,
            userId,
            userName,
            1,                              // TipoModificacion = 1
            0                               // IdRazonModificacion = 0
        ]);
        
        await connection.close();
        
        showLoading(false);
        
        Swal.fire({
            icon: 'success',
            title: '¡Factura habilitada!',
            text: 'La factura ahora puede ser modificada.',
            confirmButtonColor: '#6e78ff'
        }).then(() => {
            // Recargar la factura para mostrar los botones correctos
            selectFactura(currentFactura.Id);
        });
        
    } catch (error) {
        showLoading(false);
        console.error('Error al habilitar factura:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error al habilitar',
            text: error.message || 'No se pudo habilitar la factura.',
            confirmButtonColor: '#6e78ff'
        });
    }
}

function handleNotaCredito() {
    if (!currentFactura) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No hay una factura seleccionada.',
            confirmButtonColor: '#6e78ff'
        });
        return;
    }
    
    Swal.fire({
        icon: 'info',
        title: 'Registrar Nota de Crédito',
        html: `
            <p>Funcionalidad en desarrollo</p>
            <p><strong>Serie:</strong> ${currentFactura.Serie}</p>
            <p><strong>Número:</strong> ${currentFactura.Numero}</p>
        `,
        confirmButtonColor: '#6e78ff'
    });
}

// ========================================
// Funciones Auxiliares
// ========================================
function formatDate(dateString) {
    if (!dateString) return '-';
    
    try {
        const [year, month, day] = dateString.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        
        const dayFormatted = String(date.getDate()).padStart(2, '0');
        const monthFormatted = String(date.getMonth() + 1).padStart(2, '0');
        const yearFormatted = date.getFullYear();
        
        return `${dayFormatted}/${monthFormatted}/${yearFormatted}`;
        
    } catch (error) {
        console.error('Error al formatear fecha:', error);
        return dateString;
    }
}


function formatDateForInput(dateString) {
    if (!dateString) return '';
    
    try {
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        return `${year}-${month}-${day}`;
    } catch (error) {
        return '';
    }
}

function formatCurrency(amount) {
    if (!amount && amount !== 0) return '-';
    
    try {
        return new Intl.NumberFormat('es-GT', {
            style: 'currency',
            currency: 'GTQ',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    } catch (error) {
        return `Q ${parseFloat(amount).toFixed(2)}`;
    }
}

function showLoading(show) {
    const loadingOverlay = document.getElementById('loadingOverlay');
    loadingOverlay.style.display = show ? 'flex' : 'none';
}

// ========================================
// Funciones de Habilitar Factura
// ========================================
async function habilitarFactura(facturaId) {
    Swal.fire({
        icon: 'question',
        title: '¿Habilitar factura?',
        html: `
            <p>La factura podrá ser modificada nuevamente.</p>
        `,
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#6e78ff',
        confirmButtonText: 'Sí, habilitar',
        cancelButtonText: 'Cancelar'
    }).then(async (result) => {
        if (result.isConfirmed) {
            await ejecutarHabilitacionDesdeTabla(facturaId);
        }
    });
}

async function ejecutarHabilitacionDesdeTabla(facturaId) {
    showLoading(true);
    
    try {
        const userId = localStorage.getItem('userId');
        const userName = localStorage.getItem('userName');
        
        if (!userId || !userName) {
            throw new Error('Usuario no identificado');
        }
        
        // Obtener información de la factura
        const connection = await odbc.connect('DSN=facturas');
        
        const queryFactura = `
            SELECT
                facturas_compras.Id,
                facturas_compras.Estado,
                facturas_compras.IdInventory,
                facturas_compras.IdSucursalCori,
                facturas_compras.Sucursal,
                facturas_compras.Serie,
                facturas_compras.Numero
            FROM
                facturas_compras
            WHERE facturas_compras.Id = ?
        `;
        
        const facturaData = await connection.query(queryFactura, [facturaId]);
        
        if (facturaData.length === 0) {
            await connection.close();
            throw new Error('Factura no encontrada');
        }
        
        const factura = facturaData[0];
        
        // Obtener nombres de estados
        const nombreEstadoAnterior = await obtenerNombreEstado(factura.Estado);  // Estado actual
        const nombreEstadoNuevo = await obtenerNombreEstado(0);                  // Estado Activo
        
        // Actualizar estado a 0 (Habilitado)
        const queryUpdate = `
            UPDATE facturas_compras
            SET Estado = 0
            WHERE Id = ?
        `;
        
        await connection.query(queryUpdate, [facturaId]);
        
        // Registrar cambio en historial CON NOMBRES DE ESTADOS
        const queryHistorial = `
            INSERT INTO CambiosFacturasHistorial
            (IdTipoCambio, TipoCambio, ValorAnterior, ValorNuevo, IdInventario, IdSucursal, Sucursal, IdFacturasCompras, IdUsuario, NombreUsuario, TipoModificacion, IdRazonModificacion)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        await connection.query(queryHistorial, [
            7,                          // IdTipoCambio
            'Estado',                   // TipoCambio
            nombreEstadoAnterior,       // ValorAnterior (Nombre del estado)
            nombreEstadoNuevo,          // ValorNuevo (Nombre del estado, ej: "Activo")
            factura.IdInventory,
            factura.IdSucursalCori,
            factura.Sucursal,
            facturaId,
            userId,
            userName,
            1,                          // TipoModificacion = 1
            0                           // IdRazonModificacion = 0
        ]);
        
        await connection.close();
        
        showLoading(false);
        
        Swal.fire({
            icon: 'success',
            title: '¡Factura habilitada!',
            html: `
                <p>La factura <strong>${factura.Serie}-${factura.Numero}</strong> ha sido habilitada.</p>
            `,
            confirmButtonColor: '#6e78ff'
        }).then(() => {
            // Recargar resultados de búsqueda
            const serie = document.getElementById('searchSerie').value.trim();
            const numero = document.getElementById('searchNumero').value.trim();
            if (serie || numero) {
                searchFacturas(serie, numero);
            }
        });
        
    } catch (error) {
        showLoading(false);
        console.error('Error al habilitar factura:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error al habilitar',
            text: error.message || 'No se pudo habilitar la factura.',
            confirmButtonColor: '#6e78ff'
        });
    }
}
async function registrarNotaCredito(facturaId) {
    showLoading(true);
    
    try {
        const connection = await odbc.connect('DSN=facturas');
        
        const queryFactura = `
            SELECT
                facturas_compras.Id,
                facturas_compras.Serie,
                facturas_compras.Numero,
                facturas_compras.NombreProveedor,
                facturas_compras.MontoFactura,
                facturas_compras.IdInventory,
                facturas_compras.IdSucursalCori,
                facturas_compras.Sucursal,
                facturas_compras.IdProveedor,
                facturas_compras.NIT
            FROM
                facturas_compras
            WHERE facturas_compras.Id = ?
        `;
        
        const facturaData = await connection.query(queryFactura, [facturaId]);
        
        await connection.close();
        
        if (facturaData.length === 0) {
            showLoading(false);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Factura no encontrada.',
                confirmButtonColor: '#6e78ff'
            });
            return;
        }
        
        currentFacturaNotaCredito = facturaData[0];
        
        showLoading(false);
        
        // Abrir modal y cargar tipos
        await abrirModalNotaCredito();
        
    } catch (error) {
        showLoading(false);
        console.error('Error al obtener factura:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo obtener la información de la factura.',
            confirmButtonColor: '#6e78ff'
        });
    }
}

async function anularFactura(facturaId) {
    showLoading(true);
    
    try {
        
        const permisoResult = await verificarPermisoAnulacion();
        
        if (!permisoResult.tienePermiso) {
            showLoading(false);
            
            Swal.fire({
                icon: 'error',
                title: 'Acción no permitida',
                html: `
                    <p style="color: var(--error-color); font-size: 15px;">
                        ${permisoResult.mensaje}
                    </p>
                    <p style="color: var(--text-secondary); font-size: 13px; margin-top: 10px;">
                        <i class="fas fa-lock"></i>
                        Contacta al administrador si necesitas este permiso.
                    </p>
                `,
                confirmButtonColor: '#6e78ff',
                confirmButtonText: 'Entendido'
            });
            return;
        }
        
        const connection = await odbc.connect('DSN=facturas');
        
        const queryFactura = `
            SELECT
                facturas_compras.Id,
                facturas_compras.Estado,
                facturas_compras.IdInventory,
                facturas_compras.IdSucursalCori,
                facturas_compras.Sucursal,
                facturas_compras.Serie,
                facturas_compras.Numero,
                facturas_compras.NombreProveedor
            FROM
                facturas_compras
            WHERE facturas_compras.Id = ?
        `;
        
        const facturaData = await connection.query(queryFactura, [facturaId]);
        
        await connection.close();
        
        if (facturaData.length === 0) {
            showLoading(false);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Factura no encontrada.',
                confirmButtonColor: '#6e78ff'
            });
            return;
        }
        
        const factura = facturaData[0];
        
        if (factura.Estado !== 0) {
            showLoading(false);
            Swal.fire({
                icon: 'warning',
                title: 'No se puede anular',
                text: 'Solo se pueden anular facturas en estado activo (Estado 0).',
                confirmButtonColor: '#6e78ff'
            });
            return;
        }
        
        showLoading(false);
        
        Swal.fire({
            icon: 'warning',
            title: '¿Anular factura?',
            html: `
                <p>Se anulará la siguiente factura:</p>
                <p><strong>Serie:</strong> ${factura.Serie}</p>
                <p><strong>Número:</strong> ${factura.Numero}</p>
                <p><strong>Proveedor:</strong> ${factura.NombreProveedor}</p>
            `,
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#6e78ff',
            confirmButtonText: 'Sí, anular',
            cancelButtonText: 'Cancelar'
        }).then(async (result) => {
            if (result.isConfirmed) {
                await ejecutarAnulacion(factura);
            }
        });
        
    } catch (error) {
        showLoading(false);
        console.error('Error al obtener factura:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo obtener la información de la factura.',
            confirmButtonColor: '#6e78ff'
        });
    }
}

async function ejecutarAnulacion(factura) {
    showLoading(true);
    
    try {
        const userId = localStorage.getItem('userId');
        const userName = localStorage.getItem('userName');
        
        if (!userId || !userName) {
            throw new Error('Usuario no identificado');
        }
        
        // Obtener nombres de estados
        const nombreEstadoAnterior = await obtenerNombreEstado(0);
        const nombreEstadoNuevo = await obtenerNombreEstado(3);
        
        const connection = await odbc.connect('DSN=facturas');
        
        // 1. Actualizar estado a 3 (Anulado)
        const queryUpdate = `
            UPDATE facturas_compras
            SET Estado = 3
            WHERE Id = ?
        `;
        
        await connection.query(queryUpdate, [factura.Id]);
        
        // 2. Registrar cambio en historial CON NOMBRES DE ESTADOS
        const queryHistorial = `
            INSERT INTO CambiosFacturasHistorial
            (IdTipoCambio, TipoCambio, ValorAnterior, ValorNuevo, IdInventario, IdSucursal, Sucursal, IdFacturasCompras, IdUsuario, NombreUsuario, TipoModificacion, IdRazonModificacion)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        await connection.query(queryHistorial, [
            7,                          // IdTipoCambio (Estado)
            'Estado',                   // TipoCambio
            nombreEstadoAnterior,       // ValorAnterior (Nombre del estado, ej: "Activo")
            nombreEstadoNuevo,          // ValorNuevo (Nombre del estado, ej: "Anulado")
            factura.IdInventory,
            factura.IdSucursalCori,
            factura.Sucursal,
            factura.Id,
            userId,
            userName,
            1,                          // TipoModificacion = 1
            0                           // IdRazonModificacion = 0
        ]);
        
        await connection.close();
        
        showLoading(false);
        
        Swal.fire({
            icon: 'success',
            title: '¡Factura anulada!',
            html: `
                <p>La factura <strong>${factura.Serie}-${factura.Numero}</strong> ha sido anulada exitosamente.</p>
            `,
            confirmButtonColor: '#6e78ff'
        }).then(() => {
            // Recargar resultados de búsqueda
            const serie = document.getElementById('searchSerie').value.trim();
            const numero = document.getElementById('searchNumero').value.trim();
            if (serie || numero) {
                searchFacturas(serie, numero);
            }
        });
        
    } catch (error) {
        showLoading(false);
        console.error('Error al anular factura:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error al anular',
            text: error.message || 'No se pudo anular la factura.',
            confirmButtonColor: '#6e78ff'
        });
    }
}
async function obtenerNombreEstado(idEstado) {
    try {
        const connection = await odbc.connect('DSN=facturas');
        
        const query = `
            SELECT Estado
            FROM estado_facturas
            WHERE IdEstado = ?
        `;
        
        const result = await connection.query(query, [idEstado]);
        
        await connection.close();
        
        if (result.length > 0) {
            return result[0].Estado;
        }
        
        return idEstado.toString(); // Si no encuentra, retorna el ID como string
        
    } catch (error) {
        console.error('Error al obtener nombre de estado:', error);
        return idEstado.toString(); // En caso de error, retorna el ID como string
    }
}
async function abrirModalNotaCredito() {
    // Resetear estado
    tipoNotaCreditoSeleccionado = null;
    datosNotaCredito = {};
    
    // Mostrar paso 1
    document.getElementById('notaCreditoPaso1').style.display = 'block';
    document.getElementById('notaCreditoPaso2').style.display = 'none';
    document.getElementById('notaCreditoPaso3').style.display = 'none';
    document.getElementById('btnNextNotaCredito1').disabled = true;
    
    // Cargar tipos de nota de crédito
    await cargarTiposNotaCredito();
    
    // Mostrar modal
    document.getElementById('notaCreditoModal').style.display = 'flex';
}

async function cargarTiposNotaCredito() {
    showLoading(true);
    
    try {
        const connection = await odbc.connect('DSN=facturas');
        
        const query = `
            SELECT
                TiposNotaCredito.IdTipoNotasCredito, 
                TiposNotaCredito.TipoNotaCredito
            FROM
                TiposNotaCredito
            ORDER BY TiposNotaCredito.TipoNotaCredito
        `;
        
        const results = await connection.query(query);
        
        await connection.close();
        
        showLoading(false);
        
        if (results.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'No hay tipos disponibles',
                text: 'No se encontraron tipos de nota de crédito configurados.',
                confirmButtonColor: '#6e78ff'
            });
            cerrarModalNotaCredito();
            return;
        }
        
        mostrarTiposNotaCredito(results);
        
    } catch (error) {
        showLoading(false);
        console.error('Error al cargar tipos:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudieron cargar los tipos de nota de crédito.',
            confirmButtonColor: '#6e78ff'
        });
        cerrarModalNotaCredito();
    }
}

function mostrarTiposNotaCredito(tipos) {
    const tiposList = document.getElementById('tiposNotaCreditoList');
    tiposList.innerHTML = '';
    
    tipos.forEach(tipo => {
        const tipoCard = document.createElement('div');
        tipoCard.className = 'tipo-nota-card';
        tipoCard.innerHTML = `
            <div class="tipo-nota-icon">
                <i class="fas fa-file-alt"></i>
            </div>
            <div class="tipo-nota-content">
                <h6>${tipo.TipoNotaCredito}</h6>
            </div>
            <div class="tipo-nota-check">
                <i class="fas fa-check-circle"></i>
            </div>
        `;
        
        tipoCard.addEventListener('click', () => {
            seleccionarTipoNotaCredito(tipo, tipoCard);
        });
        
        tiposList.appendChild(tipoCard);
    });
}

function seleccionarTipoNotaCredito(tipo, cardElement) {
    // Remover selección anterior
    document.querySelectorAll('.tipo-nota-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    // Seleccionar nuevo
    cardElement.classList.add('selected');
    tipoNotaCreditoSeleccionado = tipo;
    
    // Habilitar botón continuar
    document.getElementById('btnNextNotaCredito1').disabled = false;
}

function continuarPaso2NotaCredito() {
    if (!tipoNotaCreditoSeleccionado) {
        Swal.fire({
            icon: 'warning',
            title: 'Selección requerida',
            text: 'Por favor selecciona un tipo de nota de crédito.',
            confirmButtonColor: '#6e78ff'
        });
        return;
    }
    
    // Ocultar paso 1, mostrar paso 2
    document.getElementById('notaCreditoPaso1').style.display = 'none';
    document.getElementById('notaCreditoPaso2').style.display = 'block';
    
    // Cargar información de la factura
    document.getElementById('notaFacturaSerie').textContent = currentFacturaNotaCredito.Serie || '-';
    document.getElementById('notaFacturaNumero').textContent = currentFacturaNotaCredito.Numero || '-';
    document.getElementById('notaFacturaProveedor').textContent = currentFacturaNotaCredito.NombreProveedor || '-';
    document.getElementById('tipoNotaSeleccionado').textContent = tipoNotaCreditoSeleccionado.TipoNotaCredito;
    
    // Limpiar campos
    document.getElementById('notaCreditoSerie').value = '';
    document.getElementById('notaCreditoNumero').value = '';
    document.getElementById('notaCreditoMonto').value = '';
    document.getElementById('notaCreditoFecha').value = '';
}
function continuarPaso3NotaCredito() {
    // Obtener valores
    const serie = document.getElementById('notaCreditoSerie').value.trim();
    const numero = document.getElementById('notaCreditoNumero').value.trim();
    const monto = document.getElementById('notaCreditoMonto').value.trim();
    const fecha = document.getElementById('notaCreditoFecha').value;
    
    // Validaciones
    if (!serie || !numero || !monto || !fecha) {
        Swal.fire({
            icon: 'warning',
            title: 'Campos incompletos',
            text: 'Por favor completa todos los campos requeridos.',
            confirmButtonColor: '#6e78ff'
        });
        return;
    }
    
    // Validar monto positivo
    const montoNum = parseFloat(monto);
    if (montoNum <= 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Monto inválido',
            text: 'El monto debe ser mayor a cero.',
            confirmButtonColor: '#6e78ff'
        });
        return;
    }
    
    // Guardar datos
    datosNotaCredito = {
        serie: serie,
        numero: numero,
        monto: montoNum,
        fecha: fecha
    };
    
    // Mostrar paso 3
    mostrarResumenNotaCredito();
}

function mostrarResumenNotaCredito() {
    // Ocultar paso 2, mostrar paso 3
    document.getElementById('notaCreditoPaso2').style.display = 'none';
    document.getElementById('notaCreditoPaso3').style.display = 'block';
    
    // Llenar resumen - Factura Original
    document.getElementById('resumenFacturaSerie').textContent = currentFacturaNotaCredito.Serie || '-';
    document.getElementById('resumenFacturaNumero').textContent = currentFacturaNotaCredito.Numero || '-';
    document.getElementById('resumenFacturaProveedor').textContent = currentFacturaNotaCredito.NombreProveedor || '-';
    
    // Llenar resumen - Nota de Crédito
    document.getElementById('resumenTipoNota').textContent = tipoNotaCreditoSeleccionado.TipoNotaCredito;
    document.getElementById('resumenNotaSerie').textContent = datosNotaCredito.serie;
    document.getElementById('resumenNotaNumero').textContent = datosNotaCredito.numero;
    document.getElementById('resumenNotaMonto').textContent = formatCurrency(datosNotaCredito.monto);
    document.getElementById('resumenNotaFecha').textContent = formatDate(datosNotaCredito.fecha);
}

// ========================================
// Navegación entre Pasos
// ========================================

function volverPaso1NotaCredito() {
    document.getElementById('notaCreditoPaso2').style.display = 'none';
    document.getElementById('notaCreditoPaso1').style.display = 'block';
}

function volverPaso2NotaCredito() {
    document.getElementById('notaCreditoPaso3').style.display = 'none';
    document.getElementById('notaCreditoPaso2').style.display = 'block';
}

function cerrarModalNotaCredito() {
    document.getElementById('notaCreditoModal').style.display = 'none';
    tipoNotaCreditoSeleccionado = null;
    currentFacturaNotaCredito = null;
    datosNotaCredito = {};
}
async function handleMercaderia() {
    // NO cerrar el modal todavía
    // El modal se cerrará DESPUÉS de cargar todo
    
    // Verificar que tenemos los datos necesarios
    if (!currentFacturaNotaCredito) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se encontró la información de la factura.',
            confirmButtonColor: '#6e78ff'
        });
        return;
    }
    
    if (!tipoNotaCreditoSeleccionado) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se encontró el tipo de nota de crédito.',
            confirmButtonColor: '#6e78ff'
        });
        return;
    }
    
    if (!datosNotaCredito.serie || !datosNotaCredito.numero) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se encontraron los datos de la nota de crédito.',
            confirmButtonColor: '#6e78ff'
        });
        return;
    }
    
    // Mostrar pantalla de mercadería
    await mostrarPantallaMercaderia();
    
    // AHORA SÍ cerrar el modal (después de cargar todo)
    document.getElementById('notaCreditoModal').style.display = 'none';
}
async function mostrarPantallaMercaderia() {
    showLoading(true);
    
    try {
        // Validar datos antes de continuar
        if (!currentFacturaNotaCredito) {
            throw new Error('No se encontró la información de la factura');
        }
        
        if (!tipoNotaCreditoSeleccionado) {
            throw new Error('No se encontró el tipo de nota de crédito');
        }
        
        if (!datosNotaCredito || !datosNotaCredito.serie) {
            throw new Error('No se encontraron los datos de la nota de crédito');
        }
        
        // Ocultar otras secciones
        document.getElementById('searchSection').style.display = 'none';
        document.getElementById('detailSection').style.display = 'none';
        
        // Mostrar sección de mercadería
        document.getElementById('mercaderiaSection').style.display = 'flex';
        
        // Cargar información en el header
        cargarInfoNotaMercaderia();
        
        // Cargar productos de la factura
        await cargarProductosFactura();
        
        showLoading(false);
        
    } catch (error) {
        showLoading(false);
        console.error('Error al mostrar mercadería:', error);
        
        // Si hay error, volver al modal
        document.getElementById('mercaderiaSection').style.display = 'none';
        document.getElementById('notaCreditoModal').style.display = 'flex';
        
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'No se pudo cargar la información de productos.',
            confirmButtonColor: '#6e78ff'
        });
    }
}

function cargarInfoNotaMercaderia() {
    // Validar que existan los datos
    if (!currentFacturaNotaCredito) {
        console.error('currentFacturaNotaCredito es null');
        return;
    }
    
    if (!tipoNotaCreditoSeleccionado) {
        console.error('tipoNotaCreditoSeleccionado es null');
        return;
    }
    
    if (!datosNotaCredito) {
        console.error('datosNotaCredito es null');
        return;
    }
    
    // Información de la Factura
    document.getElementById('mercaderiaFacturaSerie').textContent = currentFacturaNotaCredito.Serie || '-';
    document.getElementById('mercaderiaFacturaNumero').textContent = currentFacturaNotaCredito.Numero || '-';
    document.getElementById('mercaderiaFacturaProveedor').textContent = currentFacturaNotaCredito.NombreProveedor || '-';
    document.getElementById('mercaderiaFacturaMonto').textContent = formatCurrency(currentFacturaNotaCredito.MontoFactura || 0);
    
    // Información de la Nota de Crédito
    document.getElementById('mercaderiaTipoNota').textContent = tipoNotaCreditoSeleccionado.TipoNotaCredito || '-';
    document.getElementById('mercaderiaNotaSerie').textContent = datosNotaCredito.serie || '-';
    document.getElementById('mercaderiaNotaNumero').textContent = datosNotaCredito.numero || '-';
    document.getElementById('mercaderiaNotaMonto').textContent = formatCurrency(datosNotaCredito.monto || 0);
    document.getElementById('mercaderiaNotaFecha').textContent = formatDate(datosNotaCredito.fecha) || '-';
}
async function cargarProductosFactura() {
    showLoading(true);
    
    try {
        const idInventory = currentFacturaNotaCredito.IdInventory;
        const idSucursalCori = currentFacturaNotaCredito.IdSucursalCori;
        
        if (!idInventory || !idSucursalCori) {
            throw new Error('No se encontró el ID de inventario o sucursal de la factura');
        }
        
        const credencialesSucursal = await obtenerCredencialesSucursal(idSucursalCori);
        
        if (!credencialesSucursal) {
            throw new Error('No se pudieron obtener las credenciales de la sucursal');
        }
        
        // ✅ AGREGAR charset: 'utf8mb4' en la conexión
        const connectionSucursal = await mysql.createConnection({
            host: credencialesSucursal.serverr,
            database: credencialesSucursal.databasee,
            user: credencialesSucursal.Uid,
            password: credencialesSucursal.Pwd,
            charset: 'utf8mb4'  // ✅ AGREGAR ESTA LÍNEA
        });
        
        const [results] = await connectionSucursal.execute(
            `SELECT
                detalleinventarios.Upc, 
                detalleinventarios.Descripcion, 
                detalleinventarios.Cantidad_Rechequeo, 
                detalleinventarios.Bonificacion_Rechequeo
            FROM detalleinventarios
            WHERE detalleinventarios.IdInventarios = ? 
              AND detalleinventarios.Detalle_Rechequeo = 0
            ORDER BY detalleinventarios.Descripcion`,
            [idInventory]
        );
        
        await connectionSucursal.end();
        
        showLoading(false);
        
        if (results.length === 0) {
            mostrarProductosVacio();
            return;
        }
        
        productosFactura = results;
        mostrarTablaProductos(results);
        
    } catch (error) {
        showLoading(false);
        console.error('Error al cargar productos:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: `No se pudieron cargar los productos de la factura. ${error.message}`,
            confirmButtonColor: '#6e78ff'
        });
    }
}

function mostrarTablaProductos(productos) {
    const tbody = document.getElementById('productosTableBody');
    tbody.innerHTML = '';
    
    // Ocultar mensaje vacío, mostrar tabla
    document.getElementById('productosEmpty').style.display = 'none';
    document.querySelector('.productos-table-wrapper').style.display = 'block';
    
    // Actualizar contador de productos
    document.getElementById('totalProductos').textContent = productos.length;
    
    // Guardar UPCs para validación de duplicados
    productosEnTabla = productos.map(p => p.Upc);
    
    productos.forEach((producto, index) => {
        const row = document.createElement('tr');
        row.setAttribute('data-upc', producto.Upc);
        
        row.innerHTML = `
            <td>${producto.Upc || '-'}</td>
            <td>${producto.Descripcion || producto.DescLarga || '-'}</td>
            <td style="text-align: center;">${producto.Cantidad_Rechequeo || 0}</td>
            <td style="text-align: center;">${producto.Bonificacion_Rechequeo || 0}</td>
            <td style="text-align: center;">
                <input 
                    type="number" 
                    class="input-cantidad-devolver" 
                    id="cantidadDevolver_${index}"
                    data-index="${index}"
                    data-upc="${producto.Upc}"
                    min="0"
                    step="1"
                    value="0"
                    placeholder="0"
                />
            </td>
        `;
        
        tbody.appendChild(row);
        
        // Agregar event listener al input
        const input = document.getElementById(`cantidadDevolver_${index}`);
        input.addEventListener('input', (e) => handleCantidadChange(e, index, producto));
        input.addEventListener('change', (e) => validarCantidad(e, index));
    });
    
    // Agregar hint de F1 si no existe
    agregarHintF1();
}

function mostrarProductosVacio() {
    document.querySelector('.productos-table-wrapper').style.display = 'none';
    document.getElementById('productosEmpty').style.display = 'flex';
    document.getElementById('totalProductos').textContent = '0';
    document.getElementById('productosSeleccionados').textContent = '0';
}

// ========================================
// Manejo de Cantidades
// ========================================

function handleCantidadChange(event, index, producto) {
    const input = event.target;
    let cantidad = parseInt(input.value) || 0;
    
    // Validar que no sea negativa
    if (cantidad < 0) {
        cantidad = 0;
        input.value = 0;
    }
    
    // Agregar clase si tiene valor
    if (cantidad > 0) {
        input.classList.add('has-value');
    } else {
        input.classList.remove('has-value');
    }
    
    // Actualizar array de devolución
    actualizarProductoDevolucion(index, producto, cantidad);
}

function validarCantidad(event, index) {
    const input = event.target;
    let cantidad = parseInt(input.value);
    
    // Si está vacío o es NaN, poner 0
    if (isNaN(cantidad) || cantidad < 0) {
        input.value = 0;
        input.classList.remove('has-value');
        handleCantidadChange(event, index, productosFactura[index]);
    }
}

function actualizarProductoDevolucion(index, producto, cantidad) {
    // Buscar si ya existe en el array
    const existingIndex = productosDevolucion.findIndex(p => p.upc === producto.Upc);
    
    if (cantidad > 0) {
        const productoDevolucion = {
            upc: producto.Upc,
            descripcion: producto.Descripcion,
            cantidadOriginal: producto.Cantidad_Rechequeo,
            bonificacion: producto.Bonificacion_Rechequeo,
            cantidadDevolver: cantidad
        };
        
        if (existingIndex >= 0) {
            productosDevolucion[existingIndex] = productoDevolucion;
        } else {
            productosDevolucion.push(productoDevolucion);
        }
    } else {
        // Si la cantidad es 0, remover del array
        if (existingIndex >= 0) {
            productosDevolucion.splice(existingIndex, 1);
        }
    }
}

function cancelarNotaMercaderia() {
    Swal.fire({
        icon: 'warning',
        title: '¿Cancelar Nota de Crédito?',
        html: `
            <p>Se perderán todos los datos ingresados.</p>
            <p>¿Deseas continuar?</p>
        `,
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6e78ff',
        confirmButtonText: 'Sí, cancelar',
        cancelButtonText: 'No, continuar'
    }).then((result) => {
        if (result.isConfirmed) {
            // Limpiar datos
            productosFactura = [];
            productosDevolucion = [];
            currentFacturaNotaCredito = null;
            tipoNotaCreditoSeleccionado = null;
            datosNotaCredito = {};
            
            // Volver a la pantalla de búsqueda
            document.getElementById('mercaderiaSection').style.display = 'none';
            document.getElementById('searchSection').style.display = 'flex';
            
            Swal.fire({
                icon: 'info',
                title: 'Nota cancelada',
                text: 'La nota de crédito ha sido cancelada.',
                confirmButtonColor: '#6e78ff',
                timer: 2000
            });
        }
    });
}

function editarNotaMercaderia() {
    Swal.fire({
        icon: 'question',
        title: '¿Editar datos de Nota de Crédito?',
        html: `
            <p>Volverás al formulario de nota de crédito.</p>
            <p>Los productos seleccionados se mantendrán.</p>
        `,
        showCancelButton: true,
        confirmButtonColor: '#f59e0b',
        cancelButtonColor: '#6e78ff',
        confirmButtonText: 'Sí, editar',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            // Ocultar pantalla de mercadería
            document.getElementById('mercaderiaSection').style.display = 'none';
            
            // Abrir modal en paso 2 (formulario)
            document.getElementById('notaCreditoModal').style.display = 'flex';
            document.getElementById('notaCreditoPaso1').style.display = 'none';
            document.getElementById('notaCreditoPaso2').style.display = 'block';
            document.getElementById('notaCreditoPaso3').style.display = 'none';
            
            // Cargar datos existentes
            document.getElementById('notaCreditoSerie').value = datosNotaCredito.serie;
            document.getElementById('notaCreditoNumero').value = datosNotaCredito.numero;
            document.getElementById('notaCreditoMonto').value = datosNotaCredito.monto;
            document.getElementById('notaCreditoFecha').value = datosNotaCredito.fecha;
        }
    });
}

async function guardarMercaderia() {
    // Validar que haya productos seleccionados
    if (productosDevolucion.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Sin productos',
            text: 'Debes seleccionar al menos un producto con cantidad mayor a 0.',
            confirmButtonColor: '#6e78ff'
        });
        return;
    }
    
    // ========================================
    // PASO 1: Solicitar observaciones
    // ========================================
    
    const { value: observaciones } = await Swal.fire({
        title: 'Observaciones',
        html: `
            <div style="text-align: left;">
                <p style="margin-bottom: 10px; color: #64748b;">
                    Puedes agregar observaciones sobre esta nota de crédito (opcional):
                </p>
                <textarea 
                    id="swal-observaciones" 
                    class="swal2-textarea" 
                    placeholder="Escribe observaciones aquí..."
                    style="width: 100%; min-height: 100px; resize: vertical;"
                ></textarea>
            </div>
        `,
        icon: 'info',
        showCancelButton: true,
        confirmButtonColor: '#6e78ff',
        cancelButtonColor: '#94a3b8',
        confirmButtonText: 'Continuar',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
            return document.getElementById('swal-observaciones').value;
        }
    });
    
    if (observaciones === undefined) {
        // Usuario canceló
        return;
    }
    
    const observacionesFinal = observaciones.trim() || 'Nota de Crédito por Mercadería';
    
    // ========================================
    // PASO 2: Confirmar guardado
    // ========================================
    
    const confirmacion = await Swal.fire({
        icon: 'question',
        title: '¿Guardar Nota de Crédito?',
        html: `
            <div style="text-align: left; padding: 10px;">
                <p><strong>Tipo:</strong> ${tipoNotaCreditoSeleccionado.TipoNotaCredito}</p>
                <p><strong>Serie - Número:</strong> ${datosNotaCredito.serie} - ${datosNotaCredito.numero}</p>
                <p><strong>Monto:</strong> ${formatCurrency(datosNotaCredito.monto)}</p>
                <p><strong>Fecha:</strong> ${formatDate(datosNotaCredito.fecha)}</p>
                <p><strong>Productos:</strong> ${productosDevolucion.length}</p>
                <p><strong>Total Unidades:</strong> ${productosDevolucion.reduce((sum, p) => sum + p.cantidadDevolver, 0)}</p>
                ${observacionesFinal !== 'Nota de Crédito por Mercadería' ? 
                    `<p><strong>Observaciones:</strong> ${observacionesFinal}</p>` : ''}
            </div>
        `,
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#6e78ff',
        confirmButtonText: '<i class="fas fa-save"></i> Sí, guardar',
        cancelButtonText: 'Cancelar'
    });
    
    if (!confirmacion.isConfirmed) {
        return;
    }
    
    showLoading(true);
    
    try {
        // ========================================
        // PASO 3: Validar que no exista la nota
        // ========================================
        
        const connection = await odbc.connect('DSN=facturas');
        
        const queryValidar = `
            SELECT COUNT(*) AS Existe
            FROM NCTProveedores
            WHERE Serie = ? AND Numero = ?
        `;
        
        const resultValidar = await connection.query(queryValidar, [
            datosNotaCredito.serie,
            datosNotaCredito.numero
        ]);
        
        if (resultValidar[0].Existe > 0) {
            await connection.close();
            showLoading(false);
            
            Swal.fire({
                icon: 'error',
                title: 'Nota de Crédito Duplicada',
                html: `
                    <p>Ya existe una Nota de Crédito con:</p>
                    <p><strong>Serie:</strong> ${datosNotaCredito.serie}</p>
                    <p><strong>Número:</strong> ${datosNotaCredito.numero}</p>
                    <p style="margin-top: 15px; color: #ef4444;">
                        Por favor, verifica la serie y número e intenta nuevamente.
                    </p>
                `,
                confirmButtonColor: '#6e78ff'
            });
            return;
        }
        
        // ========================================
        // PASO 4: Obtener datos de usuario
        // ========================================
        
        const userId = localStorage.getItem('userId');
        const userName = localStorage.getItem('userName');
        
        if (!userId || !userName) {
            await connection.close();
            showLoading(false);
            
            Swal.fire({
                icon: 'error',
                title: 'Error de Sesión',
                text: 'No se pudo obtener la información del usuario. Por favor, inicia sesión nuevamente.',
                confirmButtonColor: '#6e78ff'
            });
            return;
        }
        
        // ========================================
        // PASO 5: Preparar datos para NCTProveedores
        // ========================================
        
        const datosEncabezado = {
            IdFacturaCompras: currentFacturaNotaCredito.Id,
            IdProveedor: currentFacturaNotaCredito.IdProveedor || null,
            NombreProveedore: currentFacturaNotaCredito.NombreProveedor || '',
            NIT: currentFacturaNotaCredito.NIT || '',
            Monto: datosNotaCredito.monto,
            Serie: datosNotaCredito.serie,
            Numero: datosNotaCredito.numero,
            TipoNotaCredito: tipoNotaCreditoSeleccionado.IdTipoNotasCredito,
            FechaNotaCredito: datosNotaCredito.fecha,
            Observaciones: observacionesFinal,
            IdUsuario: parseInt(userId),
            NombreUsuario: userName,
            IdConcepto: 1 // Concepto fijo: Mercadería
        };
        
        // ========================================
        // PASO 6: Insertar en NCTProveedores
        // ========================================
        
        const queryInsertEncabezado = `
            INSERT INTO NCTProveedores (
                IdFacturaCompras,
                IdProveedor,
                NombreProveedore,
                NIT,
                Monto,
                Serie,
                Numero,
                TipoNotaCredito,
                FechaNotaCredito,
                Observaciones,
                IdUsuario,
                NombreUsuario,
                IdConcepto
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const paramsEncabezado = [
            datosEncabezado.IdFacturaCompras,
            datosEncabezado.IdProveedor,
            datosEncabezado.NombreProveedore,
            datosEncabezado.NIT,
            datosEncabezado.Monto,
            datosEncabezado.Serie,
            datosEncabezado.Numero,
            datosEncabezado.TipoNotaCredito,
            datosEncabezado.FechaNotaCredito,
            datosEncabezado.Observaciones,
            datosEncabezado.IdUsuario,
            datosEncabezado.NombreUsuario,
            datosEncabezado.IdConcepto
        ];
        
        await connection.query(queryInsertEncabezado, paramsEncabezado);
        
        // ========================================
        // PASO 7: Obtener el ID insertado
        // ========================================
        
        const queryGetLastId = `
            SELECT MAX(IdNotaCreditoProveedores) AS LastId 
            FROM NCTProveedores
        `;
        
        const resultLastId = await connection.query(queryGetLastId);
        const idNTCProveedor = resultLastId[0].LastId;
        
        if (!idNTCProveedor) {
            throw new Error('No se pudo obtener el ID de la Nota de Crédito insertada');
        }
        
        // ========================================
        // PASO 8: Insertar detalles en NCTProveedoresDetalle
        // ========================================
        
        const queryInsertDetalle = `
            INSERT INTO NCTProveedoresDetalle (
                IdNTCProveedor,
                Upc,
                Descripcion,
                Cantidad
            ) VALUES (?, ?, ?, ?)
        `;
        
        let productosInsertados = 0;
        
        // Insertar cada producto
        for (const producto of productosDevolucion) {
            const paramsDetalle = [
                idNTCProveedor,
                producto.upc,
                producto.descripcion,
                producto.cantidadDevolver.toString() // Convertir a string porque el campo es varchar
            ];
            
            await connection.query(queryInsertDetalle, paramsDetalle);
            productosInsertados++;
        }
        
        // ========================================
        // PASO 9: Cerrar conexión
        // ========================================
        
        await connection.close();
        
        showLoading(false);
        
        // ========================================
        // PASO 10: Mostrar mensaje de éxito
        // ========================================
        
        Swal.fire({
            icon: 'success',
            title: '¡Nota de Crédito Guardada!',
            html: `
                <div style="text-align: left; padding: 10px;">
                    <p><strong>ID Nota:</strong> #${idNTCProveedor}</p>
                    <p><strong>Serie - Número:</strong> ${datosNotaCredito.serie} - ${datosNotaCredito.numero}</p>
                    <p><strong>Monto:</strong> ${formatCurrency(datosNotaCredito.monto)}</p>
                    <p><strong>Productos guardados:</strong> ${productosInsertados}</p>
                    <p><strong>Usuario:</strong> ${userName}</p>
                    <p style="color: #10b981; margin-top: 15px; font-weight: 600;">
                        <i class="fas fa-check-circle"></i> La nota de crédito ha sido registrada exitosamente.
                    </p>
                </div>
            `,
            confirmButtonColor: '#6e78ff',
            confirmButtonText: 'Aceptar'
        }).then(() => {
            // Limpiar y volver a la pantalla de búsqueda
            limpiarYVolverABusqueda();
        });
        
    } catch (error) {
        showLoading(false);
        console.error('Error al guardar nota de crédito:', error);
        
        Swal.fire({
            icon: 'error',
            title: 'Error al guardar',
            html: `
                <p>No se pudo guardar la nota de crédito.</p>
                <p style="color: #ef4444; font-size: 13px; margin-top: 10px; font-family: monospace;">
                    ${error.message}
                </p>
                <p style="margin-top: 15px; font-size: 12px; color: #64748b;">
                    Si el error persiste, contacta al administrador del sistema.
                </p>
            `,
            confirmButtonColor: '#6e78ff'
        });
    }
}
function limpiarYVolverABusqueda() {
    // Limpiar todas las variables
    productosFactura = [];
    productosDevolucion = [];
    productosEnTabla = [];
    currentFacturaNotaCredito = null;
    tipoNotaCreditoSeleccionado = null;
    datosNotaCredito = {};
    
    // Ocultar pantalla de mercadería
    document.getElementById('mercaderiaSection').style.display = 'none';
    
    // Mostrar pantalla de búsqueda
    document.getElementById('searchSection').style.display = 'flex';
    
    // Limpiar búsqueda si hay algo
    const searchInput = document.getElementById('searchFactura');
    if (searchInput) {
        searchInput.value = '';
    }
    
    // Limpiar tabla de resultados si existe
    const tableBody = document.getElementById('facturasTableBody');
    if (tableBody) {
        tableBody.innerHTML = '';
    }
}
async function handleOtrosConceptos() {
    // Verificar que tenemos los datos necesarios
    if (!currentFacturaNotaCredito) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se encontró la información de la factura.',
            confirmButtonColor: '#6e78ff'
        });
        return;
    }
    
    if (!tipoNotaCreditoSeleccionado) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se encontró el tipo de nota de crédito.',
            confirmButtonColor: '#6e78ff'
        });
        return;
    }
    
    if (!datosNotaCredito.serie || !datosNotaCredito.numero) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se encontraron los datos de la nota de crédito.',
            confirmButtonColor: '#6e78ff'
        });
        return;
    }
    
    // ========================================
    // PASO 1: Cerrar modal de confirmación
    // ========================================
    
    document.getElementById('notaCreditoModal').style.display = 'none';
    
    // ========================================
    // PASO 2: Solicitar observaciones/motivo
    // ========================================
    
    const { value: observaciones, isConfirmed } = await Swal.fire({
        title: 'Motivo de la Nota de Crédito',
        html: `
            <div style="text-align: left;">
                <p style="margin-bottom: 10px; color: #64748b; font-size: 14px;">
                    <i class="fas fa-info-circle"></i>
                    Describe el motivo de esta nota de crédito:
                </p>
                <textarea 
                    id="swal-observaciones-otros" 
                    class="swal2-textarea" 
                    placeholder="Ejemplo: Descuento por volumen, Error en facturación, Bonificación especial, etc."
                    style="width: 100%; min-height: 120px; resize: vertical; font-size: 14px;"
                ></textarea>
                <p style="margin-top: 10px; color: #ef4444; font-size: 12px;">
                    <i class="fas fa-exclamation-triangle"></i>
                    Este campo es obligatorio
                </p>
            </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#6e78ff',
        cancelButtonColor: '#94a3b8',
        confirmButtonText: 'Continuar',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
            const valor = document.getElementById('swal-observaciones-otros').value.trim();
            if (!valor) {
                Swal.showValidationMessage('Debes escribir el motivo de la nota de crédito');
                return false;
            }
            return valor;
        }
    });
    
    if (!isConfirmed || !observaciones) {
        // Usuario canceló o no escribió nada
        // Volver a mostrar el modal
        document.getElementById('notaCreditoModal').style.display = 'flex';
        return;
    }
    
    // ========================================
    // PASO 3: Confirmar guardado
    // ========================================
    
    const confirmacion = await Swal.fire({
        icon: 'question',
        title: '¿Guardar Nota de Crédito?',
        html: `
            <div style="text-align: left; padding: 10px;">
                <h4 style="color: var(--primary-color); margin-bottom: 15px;">
                    <i class="fas fa-file-invoice"></i> Factura Original
                </h4>
                <p><strong>Serie - Número:</strong> ${currentFacturaNotaCredito.Serie} - ${currentFacturaNotaCredito.Numero}</p>
                <p><strong>Proveedor:</strong> ${currentFacturaNotaCredito.NombreProveedor}</p>
                <p><strong>Monto Original:</strong> ${formatCurrency(currentFacturaNotaCredito.MontoFactura || 0)}</p>
                
                <hr style="margin: 15px 0; border: 1px solid rgba(110, 120, 255, 0.2);">
                
                <h4 style="color: var(--success-color); margin-bottom: 15px;">
                    <i class="fas fa-file-alt"></i> Nota de Crédito
                </h4>
                <p><strong>Tipo:</strong> ${tipoNotaCreditoSeleccionado.TipoNotaCredito}</p>
                <p><strong>Concepto:</strong> Otros Conceptos</p>
                <p><strong>Serie - Número:</strong> ${datosNotaCredito.serie} - ${datosNotaCredito.numero}</p>
                <p><strong>Monto:</strong> ${formatCurrency(datosNotaCredito.monto)}</p>
                <p><strong>Fecha:</strong> ${formatDate(datosNotaCredito.fecha)}</p>
                <p><strong>Motivo:</strong> ${observaciones}</p>
            </div>
        `,
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#6e78ff',
        confirmButtonText: '<i class="fas fa-save"></i> Sí, guardar',
        cancelButtonText: 'Cancelar',
        width: '600px'
    });
    
    if (!confirmacion.isConfirmed) {
        // Volver a mostrar el modal
        document.getElementById('notaCreditoModal').style.display = 'flex';
        return;
    }
    
    // ========================================
    // PASO 4: Guardar en base de datos
    // ========================================
    
    await guardarNotaCreditoOtrosConceptos(observaciones);
}
async function guardarNotaCreditoOtrosConceptos(observaciones) {
    showLoading(true);
    
    try {
        // ========================================
        // PASO 1: Conectar a base de datos
        // ========================================
        
        const connection = await odbc.connect('DSN=facturas');
        
        // ========================================
        // PASO 2: Validar que no exista la nota
        // ========================================
        
        const queryValidar = `
            SELECT COUNT(*) AS Existe
            FROM NCTProveedores
            WHERE Serie = ? AND Numero = ?
        `;
        
        const resultValidar = await connection.query(queryValidar, [
            datosNotaCredito.serie,
            datosNotaCredito.numero
        ]);
        
        if (resultValidar[0].Existe > 0) {
            await connection.close();
            showLoading(false);
            
            Swal.fire({
                icon: 'error',
                title: 'Nota de Crédito Duplicada',
                html: `
                    <p>Ya existe una Nota de Crédito con:</p>
                    <p><strong>Serie:</strong> ${datosNotaCredito.serie}</p>
                    <p><strong>Número:</strong> ${datosNotaCredito.numero}</p>
                    <p style="margin-top: 15px; color: #ef4444;">
                        Por favor, verifica la serie y número e intenta nuevamente.
                    </p>
                `,
                confirmButtonColor: '#6e78ff'
            });
            return;
        }
        
        // ========================================
        // PASO 3: Obtener datos de usuario
        // ========================================
        
        const userId = localStorage.getItem('userId');
        const userName = localStorage.getItem('userName');
        
        if (!userId || !userName) {
            await connection.close();
            showLoading(false);
            
            Swal.fire({
                icon: 'error',
                title: 'Error de Sesión',
                text: 'No se pudo obtener la información del usuario. Por favor, inicia sesión nuevamente.',
                confirmButtonColor: '#6e78ff'
            });
            return;
        }
        
        // ========================================
        // PASO 4: Preparar datos para NCTProveedores
        // ========================================
        
        const datosEncabezado = {
            IdFacturaCompras: currentFacturaNotaCredito.Id,
            IdProveedor: currentFacturaNotaCredito.IdProveedor || null,
            NombreProveedore: currentFacturaNotaCredito.NombreProveedor || '',
            NIT: currentFacturaNotaCredito.NIT || '',
            Monto: datosNotaCredito.monto,
            Serie: datosNotaCredito.serie,
            Numero: datosNotaCredito.numero,
            TipoNotaCredito: tipoNotaCreditoSeleccionado.IdTipoNotasCredito,
            FechaNotaCredito: datosNotaCredito.fecha,
            Observaciones: observaciones,
            IdUsuario: parseInt(userId),
            NombreUsuario: userName,
            IdConcepto: 2 // ✅ Concepto = 2 (Otros Conceptos)
        };
        
        // ========================================
        // PASO 5: Insertar en NCTProveedores
        // ========================================
        
        const queryInsertEncabezado = `
            INSERT INTO NCTProveedores (
                IdFacturaCompras,
                IdProveedor,
                NombreProveedore,
                NIT,
                Monto,
                Serie,
                Numero,
                TipoNotaCredito,
                FechaNotaCredito,
                Observaciones,
                IdUsuario,
                NombreUsuario,
                IdConcepto
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const paramsEncabezado = [
            datosEncabezado.IdFacturaCompras,
            datosEncabezado.IdProveedor,
            datosEncabezado.NombreProveedore,
            datosEncabezado.NIT,
            datosEncabezado.Monto,
            datosEncabezado.Serie,
            datosEncabezado.Numero,
            datosEncabezado.TipoNotaCredito,
            datosEncabezado.FechaNotaCredito,
            datosEncabezado.Observaciones,
            datosEncabezado.IdUsuario,
            datosEncabezado.NombreUsuario,
            datosEncabezado.IdConcepto
        ];
        
        await connection.query(queryInsertEncabezado, paramsEncabezado);
        
        // ========================================
        // PASO 6: Obtener el ID insertado
        // ========================================
        
        const queryGetLastId = `
            SELECT MAX(IdNotaCreditoProveedores) AS LastId 
            FROM NCTProveedores
        `;
        
        const resultLastId = await connection.query(queryGetLastId);
        const idNTCProveedor = resultLastId[0].LastId;
        
        if (!idNTCProveedor) {
            throw new Error('No se pudo obtener el ID de la Nota de Crédito insertada');
        }
        
        // ========================================
        // NOTA: NO se inserta en NCTProveedoresDetalle
        // porque Otros Conceptos no tiene productos
        // ========================================
        
        // ========================================
        // PASO 7: Cerrar conexión
        // ========================================
        
        await connection.close();
        
        showLoading(false);
        
        // ========================================
        // PASO 8: Mostrar mensaje de éxito
        // ========================================
        
        Swal.fire({
            icon: 'success',
            title: '¡Nota de Crédito Guardada!',
            html: `
                <div style="text-align: left; padding: 10px;">
                    <p><strong>ID Nota:</strong> #${idNTCProveedor}</p>
                    <p><strong>Concepto:</strong> Otros Conceptos</p>
                    <p><strong>Serie - Número:</strong> ${datosNotaCredito.serie} - ${datosNotaCredito.numero}</p>
                    <p><strong>Monto:</strong> ${formatCurrency(datosNotaCredito.monto)}</p>
                    <p><strong>Motivo:</strong> ${observaciones}</p>
                    <p><strong>Usuario:</strong> ${userName}</p>
                    <p style="color: #10b981; margin-top: 15px; font-weight: 600;">
                        <i class="fas fa-check-circle"></i> La nota de crédito ha sido registrada exitosamente.
                    </p>
                </div>
            `,
            confirmButtonColor: '#6e78ff',
            confirmButtonText: 'Aceptar'
        }).then(() => {
            // Limpiar y volver a la pantalla de búsqueda
            limpiarYVolverABusquedaOtrosConceptos();
        });
        
    } catch (error) {
        showLoading(false);
        console.error('Error al guardar nota de crédito:', error);
        
        Swal.fire({
            icon: 'error',
            title: 'Error al guardar',
            html: `
                <p>No se pudo guardar la nota de crédito.</p>
                <p style="color: #ef4444; font-size: 13px; margin-top: 10px; font-family: monospace;">
                    ${error.message}
                </p>
                <p style="margin-top: 15px; font-size: 12px; color: #64748b;">
                    Si el error persiste, contacta al administrador del sistema.
                </p>
            `,
            confirmButtonColor: '#6e78ff'
        });
    }
}
function limpiarYVolverABusquedaOtrosConceptos() {
    // Limpiar todas las variables
    currentFacturaNotaCredito = null;
    tipoNotaCreditoSeleccionado = null;
    datosNotaCredito = {};
    
    // Cerrar modal si está abierto
    document.getElementById('notaCreditoModal').style.display = 'none';
    
    // Mostrar pantalla de búsqueda
    document.getElementById('searchSection').style.display = 'flex';
    
    // Limpiar búsqueda si hay algo
    const searchInput = document.getElementById('searchFactura');
    if (searchInput) {
        searchInput.value = '';
    }
    
    // Limpiar tabla de resultados si existe
    const tableBody = document.getElementById('facturasTableBody');
    if (tableBody) {
        tableBody.innerHTML = '';
    }
}
function agregarHintF1() {
    const productosHeader = document.querySelector('.productos-header');
    
    // Verificar si ya existe el hint
    if (document.getElementById('f1Hint')) return;
    
    const hint = document.createElement('div');
    hint.id = 'f1Hint';
    hint.className = 'f1-hint';
    hint.innerHTML = `
        <i class="fas fa-plus-circle"></i>
        Presiona <kbd>F1</kbd> para agregar productos
    `;
    
    productosHeader.appendChild(hint);
}
function handleF1Key(event) {
    // Solo detectar F1 cuando estamos en la pantalla de mercadería
    const mercaderiaVisible = document.getElementById('mercaderiaSection').style.display === 'flex';
    
    if (event.key === 'F1' && mercaderiaVisible) {
        event.preventDefault(); // Prevenir el comportamiento por defecto de F1
        abrirModalBusqueda();
    }
}
function abrirModalBusqueda() {
    // Mostrar nombre de sucursal
    document.getElementById('busquedaSucursalNombre').textContent = 
        currentFacturaNotaCredito.Sucursal || currentFacturaNotaCredito.NombreSucursal || '-';
    
    // Resetear búsqueda
    document.getElementById('inputBusquedaProducto').value = '';
    document.getElementById('btnClearSearch').style.display = 'none';
    
    // Mostrar estado inicial
    document.getElementById('busquedaEstadoInicial').style.display = 'flex';
    document.getElementById('busquedaLoading').style.display = 'none';
    document.getElementById('busquedaSinResultados').style.display = 'none';
    document.getElementById('busquedaResultados').style.display = 'none';
    
    // Mostrar modal
    document.getElementById('busquedaProductosModal').style.display = 'flex';
    
    // Focus en input
    setTimeout(() => {
        document.getElementById('inputBusquedaProducto').focus();
    }, 100);
}

function cerrarModalBusqueda() {
    document.getElementById('busquedaProductosModal').style.display = 'none';
}
function handleSearchInput(event) {
    const input = event.target;
    const btnClear = document.getElementById('btnClearSearch');
    
    if (input.value.trim().length > 0) {
        btnClear.style.display = 'flex';
    } else {
        btnClear.style.display = 'none';
    }
}

function limpiarBusqueda() {
    document.getElementById('inputBusquedaProducto').value = '';
    document.getElementById('btnClearSearch').style.display = 'none';
    
    // Mostrar estado inicial
    document.getElementById('busquedaEstadoInicial').style.display = 'flex';
    document.getElementById('busquedaLoading').style.display = 'none';
    document.getElementById('busquedaSinResultados').style.display = 'none';
    document.getElementById('busquedaResultados').style.display = 'none';
    
    document.getElementById('inputBusquedaProducto').focus();
}
async function buscarProductos() {
    const searchText = document.getElementById('inputBusquedaProducto').value.trim();
    
    if (searchText.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Campo vacío',
            text: 'Por favor escribe algo para buscar.',
            confirmButtonColor: '#6e78ff'
        });
        return;
    }
    
    // Ocultar todos los estados
    document.getElementById('busquedaEstadoInicial').style.display = 'none';
    document.getElementById('busquedaSinResultados').style.display = 'none';
    document.getElementById('busquedaResultados').style.display = 'none';
    
    // Mostrar loading
    document.getElementById('busquedaLoading').style.display = 'flex';
    
    try {
        // Obtener credenciales de la sucursal
        const idSucursalCori = currentFacturaNotaCredito.IdSucursalCori;
        const credenciales = await obtenerCredencialesSucursal(idSucursalCori);
        
        if (!credenciales) {
            throw new Error('No se pudieron obtener las credenciales de la sucursal');
        }
        
        // Conectar a la sucursal
        const connection = await mysql.createConnection({
            host: credenciales.serverr,
            database: credenciales.databasee,
            user: credenciales.Uid,
            password: credenciales.Pwd,
            charset: 'utf8mb4'
        });
        
        // Construir consulta con búsqueda inteligente
        const palabras = searchText.split(/\s+/).filter(p => p.length > 0);
        
        // Construir condiciones LIKE para cada palabra
        let whereClauses = palabras.map(() => `DescLarga LIKE ?`).join(' AND ');
        let params = palabras.map(palabra => `%${palabra}%`);
        
        const query = `
            SELECT Upc, DescLarga
            FROM productos
            WHERE ${whereClauses}
            ORDER BY DescLarga
            LIMIT 50
        `;
        
        const [results] = await connection.execute(query, params);
        
        await connection.end();
        
        // Ocultar loading
        document.getElementById('busquedaLoading').style.display = 'none';
        
        if (results.length === 0) {
            // Sin resultados
            document.getElementById('busquedaSinResultados').style.display = 'flex';
        } else {
            // Mostrar resultados
            mostrarResultadosBusqueda(results);
        }
        
    } catch (error) {
        console.error('Error al buscar productos:', error);
        document.getElementById('busquedaLoading').style.display = 'none';
        
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: `No se pudo buscar productos. ${error.message}`,
            confirmButtonColor: '#6e78ff'
        });
    }
}
function mostrarResultadosBusqueda(productos) {
    const tbody = document.getElementById('resultadosTableBody');
    tbody.innerHTML = '';
    
    // Actualizar contador
    document.getElementById('resultadosCount').textContent = productos.length;
    
    productos.forEach(producto => {
        const row = document.createElement('tr');
        
        // Verificar si ya está en la tabla
        const yaAgregado = productosEnTabla.includes(producto.Upc);
        
        if (yaAgregado) {
            row.classList.add('producto-ya-agregado');
        }
        
        row.innerHTML = `
            <td>${producto.Upc || '-'}</td>
            <td>${producto.DescLarga || '-'}</td>
            <td style="text-align: center;">
                ${yaAgregado ? 
                    `<span class="producto-agregado-badge">
                        <i class="fas fa-check"></i>
                        Agregado
                    </span>` :
                    `<button class="btn-agregar-producto" data-upc="${producto.Upc}" data-desc="${producto.DescLarga}">
                        <i class="fas fa-plus"></i>
                        Agregar
                    </button>`
                }
            </td>
        `;
        
        tbody.appendChild(row);
        
        // Agregar event listener al botón
        if (!yaAgregado) {
            const btnAgregar = row.querySelector('.btn-agregar-producto');
            btnAgregar.addEventListener('click', () => agregarProductoATabla(producto));
        }
    });
    
    // Mostrar resultados
    document.getElementById('busquedaResultados').style.display = 'flex';
}
function agregarProductoATabla(producto) {
    // Verificar si ya existe (doble verificación)
    if (productosEnTabla.includes(producto.Upc)) {
        Swal.fire({
            icon: 'info',
            title: 'Producto ya agregado',
            text: 'Este producto ya está en la lista.',
            confirmButtonColor: '#6e78ff',
            timer: 2000
        });
        return;
    }
    
    // Agregar a array de productos de factura
    const nuevoProducto = {
        Upc: producto.Upc,
        Descripcion: producto.DescLarga,
        DescLarga: producto.DescLarga,
        Cantidad_Rechequeo: 0,
        Bonificacion_Rechequeo: 0,
        esProductoAgregado: true // Marcar como agregado manualmente
    };
    
    productosFactura.push(nuevoProducto);
    
    // Agregar a la tabla visual
    const tbody = document.getElementById('productosTableBody');
    const index = productosFactura.length - 1;
    
    const row = document.createElement('tr');
    row.setAttribute('data-upc', producto.Upc);
    row.classList.add('producto-agregado-manual');
    
    row.innerHTML = `
        <td>${producto.Upc || '-'}</td>
        <td>
            ${producto.DescLarga || '-'}
            <span style="color: var(--success-color); font-size: 11px; margin-left: 8px;">
                <i class="fas fa-plus-circle"></i> Agregado
            </span>
        </td>
        <td style="text-align: center;">0</td>
        <td style="text-align: center;">0</td>
        <td style="text-align: center;">
            <input 
                type="number" 
                class="input-cantidad-devolver has-value" 
                id="cantidadDevolver_${index}"
                data-index="${index}"
                data-upc="${producto.Upc}"
                min="0"
                step="1"
                value="0"
                placeholder="0"
            />
        </td>
    `;
    
    tbody.appendChild(row);
    
    // Agregar event listeners al input
    const input = document.getElementById(`cantidadDevolver_${index}`);
    input.addEventListener('input', (e) => handleCantidadChange(e, index, nuevoProducto));
    input.addEventListener('change', (e) => validarCantidad(e, index));
    
    // Agregar a la lista de UPCs para validación
    productosEnTabla.push(producto.Upc);
    
    // Actualizar contador
    document.getElementById('totalProductos').textContent = productosFactura.length;
    
    // Hacer scroll al producto agregado
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Focus en el input de cantidad
    setTimeout(() => {
        input.focus();
        input.select();
    }, 300);
    
    // ========================================
    // CORRECCIÓN: Verificar que el elemento exista antes de usarlo
    // ========================================
    
    // Actualizar la tabla de búsqueda para mostrar que ya está agregado
    const btnEnBusqueda = document.querySelector(`button[data-upc="${producto.Upc}"]`);
    
    if (btnEnBusqueda) {
        // ✅ Verificar que el botón existe
        const td = btnEnBusqueda.parentElement;
        
        if (td) {
            // ✅ Verificar que el td existe
            td.innerHTML = `
                <span class="producto-agregado-badge">
                    <i class="fas fa-check"></i>
                    Agregado
                </span>
            `;
        }
        
        // ✅ Verificar que existe el tr antes de agregar clase
        const tr = btnEnBusqueda.closest('tr');
        if (tr) {
            tr.classList.add('producto-ya-agregado');
        }
    }
    
    // Mensaje de éxito
    Swal.fire({
        icon: 'success',
        title: 'Producto agregado',
        text: 'El producto ha sido agregado a la lista.',
        confirmButtonColor: '#6e78ff',
        timer: 1500,
        showConfirmButton: false
    });
}
async function verificarPermisoAnulacion() {
    try {
        const userId = localStorage.getItem('userId');
        
        if (!userId) {
            throw new Error('Usuario no identificado');
        }
        
        const connection = await odbc.connect('DSN=facturas');
        
        const query = `
            SELECT Gestion_AnulacionPagoFacturas
            FROM permisos_sistema
            WHERE IdUsuario = ?
        `;
        
        const result = await connection.query(query, [userId]);
        
        await connection.close();
        
        if (result.length === 0) {
            return {
                tienePermiso: false,
                mensaje: 'No se encontraron permisos para este usuario.'
            };
        }
        
        const permiso = result[0].Gestion_AnulacionPagoFacturas;
        
        if (permiso === 'Y') {
            return {
                tienePermiso: true,
                mensaje: ''
            };
        } else {
            return {
                tienePermiso: false,
                mensaje: 'No tiene autorización para anular facturas.'
            };
        }
        
    } catch (error) {
        console.error('Error al verificar permisos:', error);
        return {
            tienePermiso: false,
            mensaje: `Error al verificar permisos: ${error.message}`
        };
    }
}
window.selectFactura = selectFactura;
window.seleccionarProveedor = seleccionarProveedor;
window.habilitarFactura = habilitarFactura;
window.registrarNotaCredito = registrarNotaCredito;
window.anularFactura = anularFactura;
window.registrarNotaCredito = registrarNotaCredito;