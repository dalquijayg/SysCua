const Swal = require('sweetalert2');
const ExcelJS = require('exceljs');
const odbc = require('odbc');
const conexionfacturas = 'DSN=local';
const mysql = require('mysql2/promise');

const conexioncentral = {
    host: '172.30.1.100',
    database: 'Gestion',
    user: 'Gestion',
    password: 'Gestion.2445'
};
const conexionNotasCompras = {
    host: '172.30.1.25',
    database: 'facturas_compras',
    user: 'compras',
    password: 'bode.24451988'
};
// ===== VARIABLES GLOBALES =====
let connectionPool = null;
let datosKardexActuales = [];
let todosLosDatosVirtualizados = []; // Array plano para virtualización
let virtualScroller = null;
class VirtualScrollerKardex {
    constructor(options) {
        this.container = options.container;
        this.data = options.data;
        this.rowHeight = options.rowHeight || 35;
        this.bufferSize = options.bufferSize || 20;
        
        this.scrollContainer = this.container.closest('.tabla-container');
        this.totalHeight = this.data.length * this.rowHeight;
        this.visibleRows = Math.ceil(this.scrollContainer.clientHeight / this.rowHeight);
        
        this.startIndex = 0;
        this.endIndex = Math.min(this.data.length, this.visibleRows + this.bufferSize * 2);
        
        this.currentRows = [];
        
        this.init();
    }
    
    init() {
        // Crear spacer superior
        this.topSpacer = document.createElement('tr');
        this.topSpacer.style.height = '0px';
        this.topSpacer.className = 'virtual-spacer-top';
        
        // Crear spacer inferior
        this.bottomSpacer = document.createElement('tr');
        this.bottomSpacer.style.height = `${this.totalHeight}px`;
        this.bottomSpacer.className = 'virtual-spacer-bottom';
        
        // Limpiar contenedor
        this.container.innerHTML = '';
        this.container.appendChild(this.topSpacer);
        this.container.appendChild(this.bottomSpacer);
        
        // Evento de scroll optimizado
        this.handleScroll = this.onScroll.bind(this);
        this.scrollContainer.addEventListener('scroll', this.handleScroll, { passive: true });
        
        // Renderizar inicial
        this.render();
    }
    
    onScroll() {
        const scrollTop = this.scrollContainer.scrollTop;
        const newStartIndex = Math.max(0, Math.floor(scrollTop / this.rowHeight) - this.bufferSize);
        
        // Solo re-renderizar si nos movemos significativamente
        if (Math.abs(newStartIndex - this.startIndex) > this.bufferSize / 2) {
            this.startIndex = newStartIndex;
            this.endIndex = Math.min(this.data.length, this.startIndex + this.visibleRows + this.bufferSize * 2);
            this.render();
        }
    }
    
    render() {
        // Remover filas actuales (excepto spacers)
        this.currentRows.forEach(row => row.remove());
        this.currentRows = [];
        
        // Actualizar altura del spacer superior
        this.topSpacer.style.height = `${this.startIndex * this.rowHeight}px`;
        
        // Actualizar altura del spacer inferior
        const remainingRows = this.data.length - this.endIndex;
        this.bottomSpacer.style.height = `${remainingRows * this.rowHeight}px`;
        
        // Crear y renderizar filas visibles
        const fragment = document.createDocumentFragment();
        
        for (let i = this.startIndex; i < this.endIndex; i++) {
            const row = this.data[i];
            const tr = this.createRow(row);
            fragment.appendChild(tr);
            this.currentRows.push(tr);
        }
        
        // Insertar todas las filas antes del bottomSpacer
        this.container.insertBefore(fragment, this.bottomSpacer);
    }
    
    createRow(item) {
        const tr = document.createElement('tr');
        
        if (item.tipo === 'header') {
            tr.className = 'subtitulo-producto';
            tr.style.height = `${this.rowHeight}px`;
            tr.innerHTML = `
                <td colspan="15" style="background-color: #4CAF50; color: white; font-weight: bold; padding: 12px; font-size: 14px;">
                    UPC: ${item.upc} - ${item.descripcion} | Saldo Inicial: ${formatearNumero(item.saldoInicial)}
                </td>
            `;
        } else if (item.tipo === 'sin-datos') {
            tr.style.height = `${this.rowHeight}px`;
            tr.innerHTML = `
                <td colspan="15" style="text-align: center; padding: 20px; color: #888; font-style: italic;">
                    ${item.mensaje}
                </td>
            `;
        } else if (item.tipo === 'separador') {
            tr.style.height = '10px';
            tr.innerHTML = `
                <td colspan="15" style="height: 10px; background-color: #1a1a1a;"></td>
            `;
        } else if (item.tipo === 'dato') {
            // Determinar color de fondo según tipo de movimiento
            let colorFondo = '';
            switch(item.tipoMovimiento) {
                case 'INGRESO':
                    colorFondo = 'background-color: rgba(76, 175, 80, 0.15);'; // Verde claro
                    break;
                case 'VENTA':
                    colorFondo = 'background-color: rgba(244, 67, 54, 0.15);'; // Rojo claro
                    break;
                case 'NOTA_CREDITO':
                    colorFondo = 'background-color: rgba(255, 152, 0, 0.15);'; // Naranja claro
                    break;
                case 'ENVIO':
                    colorFondo = 'background-color: rgba(33, 150, 243, 0.15);'; // Azul claro
                    break;
                case 'NOTA_CREDITO_COMPRA':
                    colorFondo = 'background-color: rgba(156, 39, 176, 0.15);'; // Morado claro
                    break;
                case 'VENTA_CORI':
                    colorFondo = 'background-color: rgba(255, 167, 38, 0.15);'; // Naranja (orange)
                    break;
                case 'COMPRA_CORI':
                    colorFondo = 'background-color: rgba(0, 188, 212, 0.15);'; // Celeste (cyan)
                    break;
                case 'VENTA_FEL':
                    colorFondo = 'background-color: rgba(198, 40, 40, 0.15);'; // Rojo oscuro (dark red)
                    break;
                case 'COMPRA_FEL':
                    colorFondo = 'background-color: rgba(46, 125, 50, 0.15);'; // Verde oscuro (dark green)
                    break;
            }
            
            tr.setAttribute('style', colorFondo + `height: ${this.rowHeight}px;`);
            
            const saldoTexto = item.saldo !== null ? formatearNumero(item.saldo) : '';
            
            tr.innerHTML = `
                <td>${item.idTransaccion || ''}</td>
                <td>${item.upc || ''}</td>
                <td>${item.descripcion || ''}</td>
                <td>${item.descripcionCorta || ''}</td>
                <td>${formatearNumero(item.cantidad)}</td>
                <td>${formatearNumero(item.bonificacion)}</td>
                <td>${formatearQuetzales(item.costo)}</td>
                <td>${formatearQuetzales(item.precio)}</td>
                <td>${formatearFecha(item.fechaRecepcion)}</td>
                <td>${formatearFecha(item.fechaFactura)}</td>
                <td>${item.serie || ''}</td>
                <td>${item.numero || ''}</td>
                <td>${item.uuid || ''}</td>
                <td>${item.sucursal || ''}</td>
                <td>${saldoTexto}</td>
            `;
        }
        
        return tr;
    }
    
    destroy() {
        if (this.scrollContainer && this.handleScroll) {
            this.scrollContainer.removeEventListener('scroll', this.handleScroll);
        }
        this.currentRows = [];
    }
}
// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Establecer fecha actual en los campos de fecha
        establecerFechasActuales();
        
        // Cargar razones sociales
        await cargarRazonesSociales();
        
        // Configurar event listeners
        configurarEventListeners();
        
    } catch (error) {
        console.error('Error en inicialización:', error);
        mostrarError('Error al inicializar la aplicación');
    }
});

// ===== CONFIGURACIÓN DE EVENTOS =====
function configurarEventListeners() {
    const btnBuscar = document.getElementById('btnBuscar');
    const btnExportar = document.getElementById('btnExportar');
    
    btnBuscar.addEventListener('click', realizarBusqueda);
    btnExportar.addEventListener('click', exportarAExcel);
    
    // Enter en campos de texto para buscar
    document.getElementById('upc').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') realizarBusqueda();
    });
    
    document.getElementById('saldoInicial').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') realizarBusqueda();
    });

    // F1 para buscar productos
    document.addEventListener('keydown', (e) => {
        if (e.key === 'F1') {
            e.preventDefault();
            abrirBusquedaProductos();
        }
    });
}

// ===== ESTABLECER FECHAS ACTUALES =====
function establecerFechasActuales() {
    const hoy = new Date();
    const fechaFormateada = hoy.toISOString().split('T')[0];
    
    document.getElementById('fechaInicio').value = fechaFormateada;
    document.getElementById('fechaFin').value = fechaFormateada;
}

// ===== CARGAR RAZONES SOCIALES =====
async function cargarRazonesSociales() {
    let connection;
    
    try {
        connection = await mysql.createConnection(conexioncentral);
        
        const query = `
            SELECT 
                razonessociales.Id, 
                razonessociales.NombreRazon
            FROM 
                razonessociales
            WHERE 
                razonessociales.Estado = 'V'
            ORDER BY 
                razonessociales.NombreRazon
        `;
        
        const [razones] = await connection.execute(query);
        
        const selectRazon = document.getElementById('razonSocial');
        selectRazon.innerHTML = '<option value="">Seleccione...</option>';
        
        razones.forEach(razon => {
            const option = document.createElement('option');
            option.value = razon.Id;
            option.textContent = razon.NombreRazon;
            selectRazon.appendChild(option);
        });
        
    } catch (error) {
        console.error('Error al cargar razones sociales:', error);
        mostrarError('Error al cargar las razones sociales');
    } finally {
        if (connection) await connection.end();
    }
}

// ===== BÚSQUEDA DE PRODUCTOS (F1) =====
async function abrirBusquedaProductos() {
    const { value: textoBusqueda } = await Swal.fire({
        title: 'Buscar Producto',
        input: 'text',
        inputLabel: 'Ingrese la descripción del producto',
        inputPlaceholder: 'Escriba para buscar...',
        showCancelButton: true,
        confirmButtonText: 'Buscar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#4CAF50',
        inputValidator: (value) => {
            if (!value) {
                return 'Debe ingresar un texto para buscar';
            }
        }
    });

    if (textoBusqueda) {
        await buscarProductos(textoBusqueda);
    }
}

async function buscarProductos(textoBusqueda) {
    let connection;
    
    try {
        Swal.fire({
            title: 'Buscando productos...',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        connection = await odbc.connect(conexionfacturas);
        
        // Preparar el texto de búsqueda para búsqueda flexible
        const palabrasBusqueda = textoBusqueda.trim().split(/\s+/);
        
        // Construir la condición WHERE con LIKE para cada palabra
        let whereConditions = palabrasBusqueda.map(() => 
            "productos.DescLarga LIKE ?"
        ).join(' AND ');
        
        // Preparar los parámetros con wildcards
        const parametros = palabrasBusqueda.map(palabra => `%${palabra}%`);
        
        const query = `
            SELECT
                productos.Upc, 
                productos.DescLarga, 
                productos.Costo, 
                productos.Precio
            FROM
                productos
            WHERE
                ${whereConditions}
            ORDER BY
                productos.DescLarga
        `;
        
        const resultados = await connection.query(query, parametros);
        
        // Cerrar conexión ODBC correctamente
        await connection.close();
        connection = null; // Marcar como cerrada
        
        if (resultados.length === 0) {
            Swal.fire({
                icon: 'info',
                title: 'Sin resultados',
                text: 'No se encontraron productos con esa descripción',
                confirmButtonColor: '#4CAF50'
            });
            return;
        }
        
        // Mostrar resultados en una tabla para selección
        mostrarTablaSeleccionProducto(resultados);
        
    } catch (error) {
        console.error('Error al buscar productos:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Error al buscar productos: ' + error.message,
            confirmButtonColor: '#d33'
        });
    } finally {
        // Solo intentar cerrar si la conexión existe y no fue cerrada
        if (connection) {
            try {
                await connection.close();
            } catch (e) {
                console.error('Error al cerrar conexión ODBC:', e);
            }
        }
    }
}

function mostrarTablaSeleccionProducto(productos) {
    // Construir tabla HTML con los productos
    let tablaHTML = `
        <div style="max-height: 450px; overflow-y: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <thead style="position: sticky; top: 0; background-color: #2d2d2d; z-index: 10;">
                    <tr style="background-color: #3a3a3a; color: #4CAF50;">
                        <th style="padding: 12px 8px; text-align: left; border-bottom: 2px solid #4CAF50; width: 140px; white-space: nowrap;">UPC</th>
                        <th style="padding: 12px 8px; text-align: left; border-bottom: 2px solid #4CAF50; min-width: 350px;">Descripción</th>
                        <th style="padding: 12px 8px; text-align: right; border-bottom: 2px solid #4CAF50; width: 100px;">Costo</th>
                        <th style="padding: 12px 8px; text-align: right; border-bottom: 2px solid #4CAF50; width: 100px;">Precio</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    productos.forEach((producto, index) => {
        tablaHTML += `
            <tr style="cursor: pointer; border-bottom: 1px solid #3a3a3a;" 
                class="producto-row" 
                data-upc="${producto.Upc}"
                data-index="${index}">
                <td style="padding: 10px 8px; white-space: nowrap; font-family: 'Courier New', monospace; font-size: 13px;">${producto.Upc}</td>
                <td style="padding: 10px 8px; word-wrap: break-word;">${producto.DescLarga}</td>
                <td style="padding: 10px 8px; text-align: right; white-space: nowrap;">${formatearQuetzales(producto.Costo)}</td>
                <td style="padding: 10px 8px; text-align: right; white-space: nowrap;">${formatearQuetzales(producto.Precio)}</td>
            </tr>
        `;
    });
    
    tablaHTML += `
                </tbody>
            </table>
        </div>
        <style>
            .producto-row:hover {
                background-color: #4CAF50 !important;
            }
            .producto-row:hover td {
                color: #ffffff !important;
            }
            .producto-row td {
                transition: all 0.2s ease;
            }
        </style>
    `;
    
    Swal.fire({
        title: `Productos encontrados (${productos.length})`,
        html: tablaHTML,
        width: '900px',
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'Cerrar',
        cancelButtonColor: '#6c757d',
        didOpen: () => {
            // Agregar event listeners a las filas
            const filas = document.querySelectorAll('.producto-row');
            filas.forEach(fila => {
                fila.addEventListener('click', () => {
                    const upc = fila.getAttribute('data-upc');
                    seleccionarProducto(upc);
                });
            });
        }
    });
}
function formatearNumero(valor) {
    if (valor === null || valor === undefined) return '0';
    return parseFloat(valor).toFixed(2);
}

function formatearMoneda(valor) {
    if (valor === null || valor === undefined) return 'Q0.00';
    return 'Q' + parseFloat(valor).toFixed(2);
}

function formatearQuetzales(valor) {
    if (valor === null || valor === undefined) return 'Q0.00';
    return 'Q' + parseFloat(valor).toLocaleString('es-GT', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatearFecha(fecha) {
    if (!fecha) return '';
    
    const date = new Date(fecha);
    if (isNaN(date.getTime())) return '';
    
    const dia = String(date.getDate()).padStart(2, '0');
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const anio = date.getFullYear();
    
    return `${dia}/${mes}/${anio}`;
}
function seleccionarProducto(upc) {
    const campoUpc = document.getElementById('upc');
    const valorActual = campoUpc.value.trim();
    
    // Si el campo está vacío, simplemente agregar el UPC
    if (valorActual === '') {
        campoUpc.value = upc;
    } else {
        // Si no está vacío, agregar coma y el nuevo UPC
        // Verificar si ya termina con coma
        if (valorActual.endsWith(',')) {
            campoUpc.value = valorActual + upc;
        } else {
            campoUpc.value = valorActual + ',' + upc;
        }
    }
    
    // Cerrar el modal
    Swal.close();
    
    // Mostrar mensaje de confirmación
    const upcCount = campoUpc.value.split(',').filter(u => u.trim().length > 0).length;
    Swal.fire({
        icon: 'success',
        title: 'Producto agregado',
        text: `UPC: ${upc} | Total productos: ${upcCount}`,
        timer: 1500,
        showConfirmButton: false
    });
    
    // Enfocar el campo de saldo inicial
    setTimeout(() => {
        document.getElementById('saldoInicial').focus();
    }, 1500);
}

// ===== REALIZAR BÚSQUEDA =====
async function realizarBusqueda() {
    try {
        // Obtener valores de los filtros
        const fechaInicio = document.getElementById('fechaInicio').value;
        const fechaFin = document.getElementById('fechaFin').value;
        const upcInput = document.getElementById('upc').value.trim();
        const saldoInicialInput = document.getElementById('saldoInicial').value.trim();
        const razonSocial = document.getElementById('razonSocial').value;
        const conBonificaciones = document.getElementById('conBonificaciones').checked;
        
        // Validaciones básicas
        if (!fechaInicio || !fechaFin) {
            mostrarAdvertencia('Por favor seleccione el rango de fechas');
            return;
        }
        
        if (!upcInput) {
            mostrarAdvertencia('Por favor ingrese al menos un código UPC');
            return;
        }
        
        if (!razonSocial) {
            mostrarAdvertencia('Por favor seleccione una razón social');
            return;
        }
        
        // Procesar UPCs y saldos iniciales
        const upcs = upcInput.split(',').map(u => u.trim()).filter(u => u.length > 0);
        const saldosIniciales = saldoInicialInput 
            ? saldoInicialInput.split(',').map(s => parseFloat(s.trim()) || 0)
            : [];
        
        // Completar saldos faltantes con 0
        while (saldosIniciales.length < upcs.length) {
            saldosIniciales.push(0);
        }
        
        // Mostrar loading
        Swal.fire({
            title: 'Buscando...',
            html: `Obteniendo datos del kardex para ${upcs.length} producto(s)`,
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
        
        const tiempoInicio = Date.now();
        
        // Obtener datos para cada UPC
        const todosLosProductos = [];
        let totalRegistros = 0;
        
        for (let i = 0; i < upcs.length; i++) {
            const upc = upcs[i];
            const saldoInicial = saldosIniciales[i];
            
            Swal.update({
                html: `Procesando producto ${i + 1}/${upcs.length}<br>UPC: ${upc}`
            });
            
            const datosKardex = await obtenerDatosKardex({
                fechaInicio,
                fechaFin,
                upc,
                saldoInicial,
                razonSocial,
                conBonificaciones
            });
            
            todosLosProductos.push({
                upc: upc,
                saldoInicial: saldoInicial,
                datos: datosKardex,
                descripcion: datosKardex.length > 0 ? datosKardex[0].descripcion : 'Sin datos'
            });
            
            totalRegistros += datosKardex.length;
        }
        
        const tiempoTotal = ((Date.now() - tiempoInicio) / 1000).toFixed(2);
        
        console.log(`✅ Carga completa: ${totalRegistros.toLocaleString()} registros en ${tiempoTotal}s`);
        
        // Guardar datos
        datosKardexActuales = todosLosProductos;
        
        // Preparar datos para virtualización (array plano con headers)
        prepararDatosParaVirtualizacion(todosLosProductos);
        
        // Mostrar resultados con virtualización
        mostrarResultadosVirtualizados();
        
        // Habilitar botón de exportar
        document.getElementById('btnExportar').disabled = false;
        
        Swal.close();
        
        Swal.fire({
            icon: 'success',
            title: 'Búsqueda completada',
            html: `
                <p>📊 <strong>Productos:</strong> ${upcs.length}</p>
                <p>📋 <strong>Total registros:</strong> ${totalRegistros.toLocaleString()}</p>
                <p>⏱️ <strong>Tiempo:</strong> ${tiempoTotal}s</p>
            `,
            timer: 2000,
            showConfirmButton: false
        });
        
    } catch (error) {
        console.error('Error en búsqueda:', error);
        Swal.close();
        mostrarError('Error al realizar la búsqueda: ' + error.message);
    }
}
function mostrarResultadosVirtualizados() {
    const tbody = document.getElementById('tablaKardexBody');
    
    tbody.innerHTML = '';
    
    if (todosLosDatosVirtualizados.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="15">No se encontraron resultados para los filtros seleccionados</td>
            </tr>
        `;
        return;
    }
    
    // Destruir virtualScroller anterior si existe
    if (virtualScroller) {
        virtualScroller.destroy();
    }
    
    // Crear nuevo VirtualScroller
    virtualScroller = new VirtualScrollerKardex({
        container: tbody,
        data: todosLosDatosVirtualizados,
        rowHeight: 35,
        bufferSize: 20
    });
}
function prepararDatosParaVirtualizacion(productos) {
    todosLosDatosVirtualizados = [];
    
    productos.forEach((producto, indexProducto) => {
        // Agregar fila de header del producto
        todosLosDatosVirtualizados.push({
            tipo: 'header',
            upc: producto.upc,
            descripcion: producto.descripcion,
            saldoInicial: producto.saldoInicial
        });
        
        // Agregar filas de datos
        if (producto.datos.length === 0) {
            todosLosDatosVirtualizados.push({
                tipo: 'sin-datos',
                mensaje: 'No se encontraron movimientos para este producto'
            });
        } else {
            producto.datos.forEach(item => {
                todosLosDatosVirtualizados.push({
                    tipo: 'dato',
                    ...item
                });
            });
        }
        
        // Agregar fila separadora si no es el último producto
        if (indexProducto < productos.length - 1) {
            todosLosDatosVirtualizados.push({
                tipo: 'separador'
            });
        }
    });
}
// ===== OBTENER DATOS DEL KARDEX =====
async function obtenerDatosKardex(filtros) {
    let connection;
    
    try {
        connection = await mysql.createConnection(conexioncentral);
        
        const { fechaInicio, fechaFin, upc, saldoInicial, razonSocial, conBonificaciones } = filtros;
        
        let todosLosDatos = [];
        
        // Determinar qué tablas consultar según la razón social
        switch(razonSocial) {
            case '1': // Bodegona Antigua
                todosLosDatos = await obtenerDatosBodegonaAntigua(connection, upc, fechaInicio, fechaFin, razonSocial, conBonificaciones);
                break;
            case '2': // Megared
                todosLosDatos = await obtenerDatosMegared(connection, upc, fechaInicio, fechaFin, razonSocial, conBonificaciones);
                break;
            case '3': // SurtiMayoreo
                todosLosDatos = await obtenerDatosSurtiMayoreo(connection, upc, fechaInicio, fechaFin, razonSocial, conBonificaciones);
                break;
            default:
                throw new Error('Razón social no válida');
        }
        
        // Ordenar todos los datos por fecha
        todosLosDatos.sort((a, b) => {
            const fechaA = new Date(a.fechaOrden);
            const fechaB = new Date(b.fechaOrden);
            return fechaA - fechaB;
        });
        
        // Calcular saldos acumulados
        let saldoAcumulado = parseFloat(saldoInicial);
        
        todosLosDatos.forEach(item => {
            // Solo afectar el saldo si afectaSaldo es true
            if (item.afectaSaldo) {
                if (item.tipoMovimiento === 'INGRESO') {
                    saldoAcumulado += parseFloat(item.cantidad) + parseFloat(item.bonificacion || 0);
                } else if (item.tipoMovimiento === 'ENVIO') {
                    saldoAcumulado += parseFloat(item.cantidad) + parseFloat(item.bonificacion || 0);
                } else if (item.tipoMovimiento === 'NOTA_CREDITO') {
                    saldoAcumulado += parseFloat(item.cantidad);
                } else if (item.tipoMovimiento === 'VENTA') {
                    saldoAcumulado -= parseFloat(item.cantidad);
                } else if (item.tipoMovimiento === 'NOTA_CREDITO_COMPRA') {
                    // 🆕 Las notas de crédito de compras RESTAN
                    saldoAcumulado -= parseFloat(item.cantidad);
                } else if (item.tipoMovimiento === 'VENTA_CORI') {
                    // 🆕 Ventas CORI RESTAN
                    saldoAcumulado -= parseFloat(item.cantidad);
                } else if (item.tipoMovimiento === 'COMPRA_CORI') {
                    // 🆕 Compras CORI SUMAN
                    saldoAcumulado += parseFloat(item.cantidad);
                } else if (item.tipoMovimiento === 'VENTA_FEL') {
                    // 🆕 Ventas FEL RESTAN
                    saldoAcumulado -= parseFloat(item.cantidad);
                } else if (item.tipoMovimiento === 'COMPRA_FEL') {
                    // 🆕 Compras FEL SUMAN
                    saldoAcumulado += parseFloat(item.cantidad);
                }
                item.saldo = saldoAcumulado;
            } else {
                item.saldo = null;
            }
        });
        
        await connection.end();
        
        return todosLosDatos;
        
    } catch (error) {
        console.error('Error al obtener datos del kardex:', error);
        if (connection) await connection.end();
        throw error;
    }
}
// ===== OBTENER DATOS BODEGONA ANTIGUA =====
async function obtenerDatosBodegonaAntigua(connection, upc, fechaInicio, fechaFin, idRazon, conBonificaciones) {
    const datos = [];
    
    // Consultar ventas
    const queryVentas = `
        SELECT
            ventasbodegonaantigua.IdTransaccion, 
            ventasbodegonaantigua.Upc, 
            ventasbodegonaantigua.Descripcion, 
            ventasbodegonaantigua.DescCorta, 
            ventasbodegonaantigua.Cantidad, 
            ventasbodegonaantigua.CostoUnitario, 
            ventasbodegonaantigua.PrecioUnitario, 
            ventasbodegonaantigua.Fecha, 
            ventasbodegonaantigua.Serie, 
            ventasbodegonaantigua.NoDocumento, 
            ventasbodegonaantigua.UUID, 
            ventasbodegonaantigua.NombreSucursal
        FROM
            ventasbodegonaantigua
        WHERE
            ventasbodegonaantigua.Upc = ? AND
            ventasbodegonaantigua.Fecha BETWEEN ? AND ?
        ORDER BY
            ventasbodegonaantigua.Fecha
    `;
    
    const [ventas] = await connection.execute(queryVentas, [upc, fechaInicio, fechaFin]);
    
    ventas.forEach(venta => {
        datos.push({
            idTransaccion: venta.IdTransaccion,
            upc: venta.Upc,
            descripcion: venta.Descripcion,
            descripcionCorta: venta.DescCorta,
            cantidad: venta.Cantidad,
            bonificacion: 0,
            costo: venta.CostoUnitario,
            precio: venta.PrecioUnitario,
            fechaRecepcion: null,
            fechaFactura: venta.Fecha,
            serie: venta.Serie,
            numero: venta.NoDocumento,
            uuid: venta.UUID,
            sucursal: venta.NombreSucursal,
            fechaOrden: venta.Fecha,
            tipoMovimiento: 'VENTA',
            afectaSaldo: true
        });
    });
    
    // Consultar notas de crédito (clientes)
    const queryNotas = `
        SELECT
            notacreditobodegonaantigua.IdNotaCredito, 
            notacreditobodegonaantigua.Upc, 
            notacreditobodegonaantigua.Descripcion, 
            notacreditobodegonaantigua.DescCorta, 
            notacreditobodegonaantigua.Cantidad, 
            notacreditobodegonaantigua.CostoUnitario, 
            notacreditobodegonaantigua.PrecioUnitario, 
            notacreditobodegonaantigua.Fecha, 
            notacreditobodegonaantigua.Serie, 
            notacreditobodegonaantigua.NoDocumento, 
            notacreditobodegonaantigua.UUID, 
            notacreditobodegonaantigua.NombreSucursal
        FROM
            notacreditobodegonaantigua
        WHERE
            notacreditobodegonaantigua.Upc = ? AND
            notacreditobodegonaantigua.Fecha BETWEEN ? AND ?
        ORDER BY
            notacreditobodegonaantigua.Fecha
    `;
    
    const [notas] = await connection.execute(queryNotas, [upc, fechaInicio, fechaFin]);
    
    notas.forEach(nota => {
        datos.push({
            idTransaccion: nota.IdNotaCredito,
            upc: nota.Upc,
            descripcion: nota.Descripcion,
            descripcionCorta: nota.DescCorta,
            cantidad: nota.Cantidad,
            bonificacion: 0,
            costo: nota.CostoUnitario,
            precio: nota.PrecioUnitario,
            fechaRecepcion: null,
            fechaFactura: nota.Fecha,
            serie: nota.Serie,
            numero: nota.NoDocumento,
            uuid: nota.UUID,
            sucursal: nota.NombreSucursal,
            fechaOrden: nota.Fecha,
            tipoMovimiento: 'NOTA_CREDITO',
            afectaSaldo: true
        });
    });
    
    // Consultar ingresos
    const queryIngresos = `
        SELECT
            ingresosinventarios.IdInventario, 
            ingresosinventarios.Upc, 
            ingresosinventarios.Descripcion, 
            ingresosinventarios.Cantidad, 
            ingresosinventarios.Bonificacion,
            ingresosinventarios.Costo, 
            ingresosinventarios.FechaFactura, 
            ingresosinventarios.FechaRecepcion, 
            ingresosinventarios.NumeroFactura, 
            ingresosinventarios.SerieFactura, 
            ingresosinventarios.NombreSucursal,
            ingresosinventarios.Operacion
        FROM
            ingresosinventarios
        WHERE
            ingresosinventarios.IdRazonSocial = ? AND
            ingresosinventarios.Upc = ? AND
            ingresosinventarios.FechaFactura BETWEEN ? AND ?
        ORDER BY
            ingresosinventarios.FechaFactura
    `;
    
    const [ingresos] = await connection.execute(queryIngresos, [idRazon, upc, fechaInicio, fechaFin]);
    
    ingresos.forEach(ingreso => {
        const esEnvio = ingreso.Operacion === '5';
        const afectaSaldo = esEnvio ? conBonificaciones : true;
        
        datos.push({
            idTransaccion: ingreso.IdInventario,
            upc: ingreso.Upc,
            descripcion: ingreso.Descripcion,
            descripcionCorta: '',
            cantidad: ingreso.Cantidad,
            bonificacion: ingreso.Bonificacion || 0,
            costo: ingreso.Costo,
            precio: '',
            fechaRecepcion: ingreso.FechaRecepcion,
            fechaFactura: ingreso.FechaFactura,
            serie: ingreso.SerieFactura,
            numero: ingreso.NumeroFactura,
            uuid: '',
            sucursal: ingreso.NombreSucursal,
            fechaOrden: ingreso.FechaFactura,
            tipoMovimiento: esEnvio ? 'ENVIO' : 'INGRESO',
            afectaSaldo: afectaSaldo
        });
    });
    
    // 🆕 Consultar Notas de Crédito de Compras
    const notasCompras = await obtenerNotasCreditoCompras(upc, fechaInicio, fechaFin, idRazon);
    datos.push(...notasCompras);
    
    const facturasCORI = await obtenerFacturasCORI(upc, fechaInicio, fechaFin, idRazon);
    datos.push(...facturasCORI);

    const facturasFEL = await obtenerFacturasManualesFEL(connection, upc, fechaInicio, fechaFin, idRazon);
    datos.push(...facturasFEL);
    return datos;
}

// ===== OBTENER DATOS MEGARED =====
async function obtenerDatosMegared(connection, upc, fechaInicio, fechaFin, idRazon, conBonificaciones) {
    const datos = [];
    
    // Consultar ventas
    const queryVentas = `
        SELECT
            ventasmegared.IdTransaccion, 
            ventasmegared.IdCaja, 
            ventasmegared.Upc, 
            ventasmegared.Descripcion, 
            ventasmegared.DescCorta, 
            ventasmegared.Cantidad, 
            ventasmegared.CostoUnitario, 
            ventasmegared.PrecioUnitario, 
            ventasmegared.Fecha, 
            ventasmegared.Serie, 
            ventasmegared.NoDocumento, 
            ventasmegared.UUID, 
            ventasmegared.NombreSucursal
        FROM
            ventasmegared
        WHERE
            ventasmegared.Upc = ? AND
            ventasmegared.Fecha BETWEEN ? AND ?
        ORDER BY
            ventasmegared.Fecha
    `;
    
    const [ventas] = await connection.execute(queryVentas, [upc, fechaInicio, fechaFin]);
    
    ventas.forEach(venta => {
        datos.push({
            idTransaccion: venta.IdTransaccion,
            upc: venta.Upc,
            descripcion: venta.Descripcion,
            descripcionCorta: venta.DescCorta,
            cantidad: venta.Cantidad,
            bonificacion: 0,
            costo: venta.CostoUnitario,
            precio: venta.PrecioUnitario,
            fechaRecepcion: null,
            fechaFactura: venta.Fecha,
            serie: venta.Serie,
            numero: venta.NoDocumento,
            uuid: venta.UUID,
            sucursal: venta.NombreSucursal,
            fechaOrden: venta.Fecha,
            tipoMovimiento: 'VENTA',
            afectaSaldo: true
        });
    });
    
    // Consultar notas de crédito (clientes)
    const queryNotas = `
        SELECT
            notacreditomegared.IdNotaCredito, 
            notacreditomegared.Upc, 
            notacreditomegared.Descripcion, 
            notacreditomegared.DescCorta, 
            notacreditomegared.Cantidad, 
            notacreditomegared.CostoUnitario, 
            notacreditomegared.PrecioUnitario, 
            notacreditomegared.Fecha, 
            notacreditomegared.Serie, 
            notacreditomegared.NoDocumento, 
            notacreditomegared.UUID, 
            notacreditomegared.NombreSucursal
        FROM
            notacreditomegared
        WHERE
            notacreditomegared.Upc = ? AND
            notacreditomegared.Fecha BETWEEN ? AND ?
        ORDER BY
            notacreditomegared.Fecha
    `;
    
    const [notas] = await connection.execute(queryNotas, [upc, fechaInicio, fechaFin]);
    
    notas.forEach(nota => {
        datos.push({
            idTransaccion: nota.IdNotaCredito,
            upc: nota.Upc,
            descripcion: nota.Descripcion,
            descripcionCorta: nota.DescCorta,
            cantidad: nota.Cantidad,
            bonificacion: 0,
            costo: nota.CostoUnitario,
            precio: nota.PrecioUnitario,
            fechaRecepcion: null,
            fechaFactura: nota.Fecha,
            serie: nota.Serie,
            numero: nota.NoDocumento,
            uuid: nota.UUID,
            sucursal: nota.NombreSucursal,
            fechaOrden: nota.Fecha,
            tipoMovimiento: 'NOTA_CREDITO',
            afectaSaldo: true
        });
    });
    
    // Consultar ingresos
    const queryIngresos = `
        SELECT
            ingresosinventarios.IdInventario, 
            ingresosinventarios.Upc, 
            ingresosinventarios.Descripcion, 
            ingresosinventarios.Cantidad, 
            ingresosinventarios.Bonificacion,
            ingresosinventarios.Costo, 
            ingresosinventarios.FechaFactura, 
            ingresosinventarios.FechaRecepcion, 
            ingresosinventarios.NumeroFactura, 
            ingresosinventarios.SerieFactura, 
            ingresosinventarios.NombreSucursal,
            ingresosinventarios.Operacion
        FROM
            ingresosinventarios
        WHERE
            ingresosinventarios.IdRazonSocial = ? AND
            ingresosinventarios.Upc = ? AND
            ingresosinventarios.FechaFactura BETWEEN ? AND ?
        ORDER BY
            ingresosinventarios.FechaFactura
    `;
    
    const [ingresos] = await connection.execute(queryIngresos, [idRazon, upc, fechaInicio, fechaFin]);
    
    ingresos.forEach(ingreso => {
        const esEnvio = ingreso.Operacion === '5';
        const afectaSaldo = esEnvio ? conBonificaciones : true;
        
        datos.push({
            idTransaccion: ingreso.IdInventario,
            upc: ingreso.Upc,
            descripcion: ingreso.Descripcion,
            descripcionCorta: '',
            cantidad: ingreso.Cantidad,
            bonificacion: ingreso.Bonificacion || 0,
            costo: ingreso.Costo,
            precio: '',
            fechaRecepcion: ingreso.FechaRecepcion,
            fechaFactura: ingreso.FechaFactura,
            serie: ingreso.SerieFactura,
            numero: ingreso.NumeroFactura,
            uuid: '',
            sucursal: ingreso.NombreSucursal,
            fechaOrden: ingreso.FechaFactura,
            tipoMovimiento: esEnvio ? 'ENVIO' : 'INGRESO',
            afectaSaldo: afectaSaldo
        });
    });
    
    // 🆕 Consultar Notas de Crédito de Compras
    const notasCompras = await obtenerNotasCreditoCompras(upc, fechaInicio, fechaFin, idRazon);
    datos.push(...notasCompras);
    
    const facturasCORI = await obtenerFacturasCORI(upc, fechaInicio, fechaFin, idRazon);
    datos.push(...facturasCORI);

    const facturasFEL = await obtenerFacturasManualesFEL(connection, upc, fechaInicio, fechaFin, idRazon);
    datos.push(...facturasFEL);
    return datos;
}

// ===== OBTENER DATOS SURTI MAYOREO =====
async function obtenerDatosSurtiMayoreo(connection, upc, fechaInicio, fechaFin, idRazon, conBonificaciones) {
    const datos = [];
    
    // Consultar ingresos
    const queryIngresos = `
        SELECT
            ingresosinventarios.IdInventario, 
            ingresosinventarios.Upc, 
            ingresosinventarios.Descripcion, 
            ingresosinventarios.Cantidad, 
            ingresosinventarios.Bonificacion,
            ingresosinventarios.Costo, 
            ingresosinventarios.FechaFactura, 
            ingresosinventarios.FechaRecepcion, 
            ingresosinventarios.NumeroFactura, 
            ingresosinventarios.SerieFactura, 
            ingresosinventarios.NombreSucursal,
            ingresosinventarios.Operacion
        FROM
            ingresosinventarios
        WHERE
            ingresosinventarios.IdRazonSocial = ? AND
            ingresosinventarios.Upc = ? AND
            ingresosinventarios.FechaFactura BETWEEN ? AND ?
        ORDER BY
            ingresosinventarios.FechaFactura
    `;
    
    const [ingresos] = await connection.execute(queryIngresos, [idRazon, upc, fechaInicio, fechaFin]);
    
    ingresos.forEach(ingreso => {
        const esEnvio = ingreso.Operacion === '5';
        const afectaSaldo = esEnvio ? conBonificaciones : true;
        
        datos.push({
            idTransaccion: ingreso.IdInventario,
            upc: ingreso.Upc,
            descripcion: ingreso.Descripcion,
            descripcionCorta: '',
            cantidad: ingreso.Cantidad,
            bonificacion: ingreso.Bonificacion || 0,
            costo: ingreso.Costo,
            precio: '',
            fechaRecepcion: ingreso.FechaRecepcion,
            fechaFactura: ingreso.FechaFactura,
            serie: ingreso.SerieFactura,
            numero: ingreso.NumeroFactura,
            uuid: '',
            sucursal: ingreso.NombreSucursal,
            fechaOrden: ingreso.FechaFactura,
            tipoMovimiento: esEnvio ? 'ENVIO' : 'INGRESO',
            afectaSaldo: afectaSaldo
        });
    });
    
    // Consultar ventas
    const queryVentas = `
        SELECT
            ventassurtimayoreo.IdTransaccion, 
            ventassurtimayoreo.Upc, 
            ventassurtimayoreo.Descripcion, 
            ventassurtimayoreo.Cantidad, 
            ventassurtimayoreo.Fecha, 
            ventassurtimayoreo.Costo, 
            ventassurtimayoreo.Precio, 
            ventassurtimayoreo.NoDocumento, 
            ventassurtimayoreo.Serie, 
            ventassurtimayoreo.UUID, 
            ventassurtimayoreo.NombreSucursal
        FROM
            ventassurtimayoreo
        WHERE
            ventassurtimayoreo.Upc = ? AND
            ventassurtimayoreo.Fecha BETWEEN ? AND ?
        ORDER BY
            ventassurtimayoreo.Fecha
    `;
    
    const [ventas] = await connection.execute(queryVentas, [upc, fechaInicio, fechaFin]);
    
    ventas.forEach(venta => {
        datos.push({
            idTransaccion: venta.IdTransaccion,
            upc: venta.Upc,
            descripcion: venta.Descripcion,
            descripcionCorta: '',
            cantidad: venta.Cantidad,
            bonificacion: 0,
            costo: venta.Costo,
            precio: venta.Precio,
            fechaRecepcion: null,
            fechaFactura: venta.Fecha,
            serie: venta.Serie,
            numero: venta.NoDocumento,
            uuid: venta.UUID,
            sucursal: venta.NombreSucursal,
            fechaOrden: venta.Fecha,
            tipoMovimiento: 'VENTA',
            afectaSaldo: true
        });
    });
    
    // Consultar notas de crédito (clientes)
    const queryNotas = `
        SELECT
            notascreditosurtimayoreo.IdNotaCredito, 
            notascreditosurtimayoreo.Upc, 
            notascreditosurtimayoreo.Descripcion, 
            notascreditosurtimayoreo.DescCorta, 
            notascreditosurtimayoreo.CostoUnitario, 
            notascreditosurtimayoreo.PrecioUnitario, 
            notascreditosurtimayoreo.Cantidad, 
            notascreditosurtimayoreo.Fecha, 
            notascreditosurtimayoreo.NoDocumento, 
            notascreditosurtimayoreo.Serie, 
            notascreditosurtimayoreo.UUID, 
            notascreditosurtimayoreo.NombreSucursal
        FROM
            notascreditosurtimayoreo
        WHERE
            notascreditosurtimayoreo.Upc = ? AND
            notascreditosurtimayoreo.Fecha BETWEEN ? AND ?
        ORDER BY
            notascreditosurtimayoreo.Fecha
    `;
    
    const [notas] = await connection.execute(queryNotas, [upc, fechaInicio, fechaFin]);
    
    notas.forEach(nota => {
        datos.push({
            idTransaccion: nota.IdNotaCredito,
            upc: nota.Upc,
            descripcion: nota.Descripcion,
            descripcionCorta: nota.DescCorta,
            cantidad: nota.Cantidad,
            bonificacion: 0,
            costo: nota.CostoUnitario,
            precio: nota.PrecioUnitario,
            fechaRecepcion: null,
            fechaFactura: nota.Fecha,
            serie: nota.Serie,
            numero: nota.NoDocumento,
            uuid: nota.UUID,
            sucursal: nota.NombreSucursal,
            fechaOrden: nota.Fecha,
            tipoMovimiento: 'NOTA_CREDITO',
            afectaSaldo: true
        });
    });
    
    // 🆕 Consultar Notas de Crédito de Compras
    const notasCompras = await obtenerNotasCreditoCompras(upc, fechaInicio, fechaFin, idRazon);
    datos.push(...notasCompras);
    
    const facturasCORI = await obtenerFacturasCORI(upc, fechaInicio, fechaFin, idRazon);
    datos.push(...facturasCORI);

    const facturasFEL = await obtenerFacturasManualesFEL(connection, upc, fechaInicio, fechaFin, idRazon);
    datos.push(...facturasFEL);
    return datos;
}

// ===== MENSAJES DE USUARIO =====
function mostrarError(mensaje) {
    Swal.fire({
        icon: 'error',
        title: 'Error',
        text: mensaje,
        confirmButtonColor: '#d33'
    });
}

function mostrarAdvertencia(mensaje) {
    Swal.fire({
        icon: 'warning',
        title: 'Atención',
        text: mensaje,
        confirmButtonColor: '#f0ad4e'
    });
}

function mostrarExito(mensaje) {
    Swal.fire({
        icon: 'success',
        title: 'Éxito',
        text: mensaje,
        confirmButtonColor: '#4CAF50',
        timer: 2000
    });
}
// ===== EXPORTAR A EXCEL =====
async function exportarAExcel() {
    if (datosKardexActuales.length === 0) {
        mostrarAdvertencia('No hay datos para exportar. Realice una búsqueda primero.');
        return;
    }
    
    // ⚡ MOSTRAR LOADING INMEDIATAMENTE
    Swal.fire({
        title: 'Preparando exportación...',
        html: 'Calculando registros a exportar',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });
    
    // Pequeño delay para que el loading se muestre
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
        // Calcular total de registros
        let totalRegistros = 0;
        datosKardexActuales.forEach(producto => {
            totalRegistros += producto.datos.length;
        });
        
        // Actualizar mensaje con info
        Swal.update({
            title: 'Exportación a Excel',
            html: `
                <p>Se exportarán <strong>${totalRegistros.toLocaleString()}</strong> registros</p>
                <p>Distribuidos en <strong>${datosKardexActuales.length}</strong> hoja(s) (una por producto)</p>
                <p style="margin-top: 15px; color: #666;">¿Desea continuar?</p>
            `
        });
        
        Swal.hideLoading();
        
        // Agregar botones de confirmación
        const result = await Swal.fire({
            title: 'Exportación a Excel',
            html: `
                <p>Se exportarán <strong>${totalRegistros.toLocaleString()}</strong> registros</p>
                <p>Distribuidos en <strong>${datosKardexActuales.length}</strong> hoja(s) (una por producto)</p>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, exportar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#4CAF50',
            cancelButtonColor: '#6c757d'
        });
        
        if (!result.isConfirmed) return;
        
        // ⚡ MOSTRAR LOADING INMEDIATAMENTE DESPUÉS DE CONFIRMAR
        Swal.fire({
            title: 'Iniciando exportación...',
            html: 'Preparando archivo Excel',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
        
        // ⚡ FORZAR ACTUALIZACIÓN DE UI ANTES DE CONTINUAR
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Ahora sí, crear el workbook
        const workbook = new ExcelJS.Workbook();
        
        // Obtener información adicional
        const fechaInicio = document.getElementById('fechaInicio').value;
        const fechaFin = document.getElementById('fechaFin').value;
        const razonSocialSelect = document.getElementById('razonSocial');
        const razonSocialNombre = razonSocialSelect.options[razonSocialSelect.selectedIndex].text;
        
        // Formatear fechas correctamente
        const fechaInicioFormateada = formatearFechaExcel(fechaInicio);
        const fechaFinFormateada = formatearFechaExcel(fechaFin);
        
        let hojasProcesadas = 0;
        
        // Crear una hoja por cada producto
        for (const producto of datosKardexActuales) {
            // Actualizar progreso
            hojasProcesadas++;
            Swal.update({
                title: 'Generando archivo Excel...',
                html: `Procesando hoja ${hojasProcesadas}/${datosKardexActuales.length}<br>UPC: ${producto.upc}`
            });
            
            // ⚡ Pequeño delay cada 3 hojas para actualizar UI
            if (hojasProcesadas % 3 === 0) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
            
            // Nombre de la hoja (máximo 31 caracteres en Excel)
            const nombreHoja = `${producto.upc}`.substring(0, 31);
            const worksheet = workbook.addWorksheet(nombreHoja);
            
            // Agregar título y información del reporte
            worksheet.mergeCells('A1:O1');
            worksheet.getCell('A1').value = 'KARDEX DE INVENTARIO';
            worksheet.getCell('A1').font = { size: 16, bold: true };
            worksheet.getCell('A1').alignment = { horizontal: 'center' };
            
            worksheet.mergeCells('A2:O2');
            worksheet.getCell('A2').value = `Razón Social: ${razonSocialNombre}`;
            worksheet.getCell('A2').font = { size: 12, bold: true };
            
            worksheet.mergeCells('A3:G3');
            worksheet.getCell('A3').value = `UPC: ${producto.upc} | Período: ${fechaInicioFormateada} - ${fechaFinFormateada}`;
            worksheet.getCell('A3').font = { size: 11 };
            
            worksheet.mergeCells('H3:O3');
            worksheet.getCell('H3').value = `Saldo Inicial: ${formatearNumero(producto.saldoInicial)}`;
            worksheet.getCell('H3').font = { size: 11, bold: true };
            worksheet.getCell('H3').alignment = { horizontal: 'right' };
            
            // Agregar leyenda de colores en la fila 4
            worksheet.getCell('A4').value = 'Leyenda:';
            worksheet.getCell('A4').font = { bold: true, size: 10 };
            
            worksheet.getCell('B4').value = 'Ingresos';
            worksheet.getCell('B4').fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE8F5E9' }
            };
            worksheet.getCell('B4').font = { size: 10 };
            worksheet.getCell('B4').alignment = { horizontal: 'center' };
            
            worksheet.getCell('C4').value = 'Ventas';
            worksheet.getCell('C4').fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFEBEE' }
            };
            worksheet.getCell('C4').font = { size: 10 };
            worksheet.getCell('C4').alignment = { horizontal: 'center' };
            
            worksheet.getCell('D4').value = 'Notas de Crédito';
            worksheet.getCell('D4').fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFF3E0' }
            };
            worksheet.getCell('D4').font = { size: 10 };
            worksheet.getCell('D4').alignment = { horizontal: 'center' };
            
            worksheet.getCell('E4').value = 'Envíos';
            worksheet.getCell('E4').fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE3F2FD' }
            };
            worksheet.getCell('E4').font = { size: 10 };
            worksheet.getCell('E4').alignment = { horizontal: 'center' };

            worksheet.getCell('F4').value = 'Notas Crédito Compras';
            worksheet.getCell('F4').fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE1BEE7' }
            };
            worksheet.getCell('F4').font = { size: 10 };
            worksheet.getCell('F4').alignment = { horizontal: 'center' };
            
            worksheet.getCell('G4').value = 'Facturas CORI - Ventas';
            worksheet.getCell('G4').fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFE0B2' }
            };
            worksheet.getCell('G4').font = { size: 10 };
            worksheet.getCell('G4').alignment = { horizontal: 'center' };

            worksheet.getCell('H4').value = 'Facturas CORI - Compras';
            worksheet.getCell('H4').fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFB2EBF2' }
            };
            worksheet.getCell('H4').font = { size: 10 };
            worksheet.getCell('H4').alignment = { horizontal: 'center' };

            worksheet.getCell('I4').value = 'Facturas FEL - Ventas';
            worksheet.getCell('I4').fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFEF9A9A' }
            };
            worksheet.getCell('I4').font = { size: 10 };
            worksheet.getCell('I4').alignment = { horizontal: 'center' };

            worksheet.getCell('J4').value = 'Facturas FEL - Compras';
            worksheet.getCell('J4').fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFA5D6A7' }
            };
            worksheet.getCell('J4').font = { size: 10 };
            worksheet.getCell('J4').alignment = { horizontal: 'center' };
            // Agregar encabezados de columnas en la fila 6
            const headerRow = worksheet.getRow(6);
            headerRow.values = [
                'IdTransaccion/Inventario',
                'UPC',
                'Descripción',
                'Descripción Corta',
                'Cantidad',
                'Bonificación',
                'Costo',
                'Precio',
                'Fecha/Recepción',
                'Fecha Factura',
                'Serie',
                'Número',
                'UUID',
                'Sucursal',
                'Saldo'
            ];
            
            // Estilo para el encabezado
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF4CAF50' }
            };
            headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
            
            // Agregar bordes al encabezado
            headerRow.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
            
            // Ajustar anchos de columnas
            worksheet.getColumn(1).width = 20;  // IdTransaccion
            worksheet.getColumn(2).width = 15;  // UPC
            worksheet.getColumn(3).width = 40;  // Descripción
            worksheet.getColumn(4).width = 25;  // Descripción Corta
            worksheet.getColumn(5).width = 12;  // Cantidad
            worksheet.getColumn(6).width = 12;  // Bonificación
            worksheet.getColumn(7).width = 12;  // Costo
            worksheet.getColumn(8).width = 12;  // Precio
            worksheet.getColumn(9).width = 15;  // Fecha/Recepción
            worksheet.getColumn(10).width = 15; // Fecha Factura
            worksheet.getColumn(11).width = 12; // Serie
            worksheet.getColumn(12).width = 15; // Número
            worksheet.getColumn(13).width = 40; // UUID
            worksheet.getColumn(14).width = 25; // Sucursal
            worksheet.getColumn(15).width = 12; // Saldo
            
            // Agregar los datos a partir de la fila 7
            producto.datos.forEach(item => {
                const row = worksheet.addRow([
                    item.idTransaccion || '',
                    item.upc || '',
                    item.descripcion || '',
                    item.descripcionCorta || '',
                    parseFloat(item.cantidad) || 0,
                    parseFloat(item.bonificacion) || 0,
                    parseFloat(item.costo) || 0,
                    parseFloat(item.precio) || 0,
                    item.fechaRecepcion ? formatearFecha(item.fechaRecepcion) : '',
                    item.fechaFactura ? formatearFecha(item.fechaFactura) : '',
                    item.serie || '',
                    item.numero || '',
                    item.uuid || '',
                    item.sucursal || '',
                    item.saldo !== null ? parseFloat(item.saldo) : ''
                ]);
                
                // Aplicar color de fondo según tipo de movimiento
                let colorFondo = 'FFFFFFFF'; // Blanco por defecto
                switch(item.tipoMovimiento) {
                    case 'INGRESO':
                        colorFondo = 'FFE8F5E9'; // Verde claro
                        break;
                    case 'VENTA':
                        colorFondo = 'FFFFEBEE'; // Rojo claro
                        break;
                    case 'NOTA_CREDITO':
                        colorFondo = 'FFFFF3E0'; // Naranja claro
                        break;
                    case 'ENVIO':
                        colorFondo = 'FFE3F2FD'; // Azul claro
                        break;
                    case 'NOTA_CREDITO_COMPRA':
                        colorFondo = 'FFE1BEE7'; // Morado claro
                        break;
                    case 'VENTA_CORI':
                        colorFondo = 'FFFFE0B2'; // Naranja
                        break;
                    case 'COMPRA_CORI':
                        colorFondo = 'FFB2EBF2'; // Celeste
                        break;
                    case 'VENTA_FEL':
                        colorFondo = 'FFEF9A9A'; // Rojo oscuro
                        break;
                    case 'COMPRA_FEL':
                        colorFondo = 'FFA5D6A7'; // Verde oscuro
                        break;
                }
                
                row.eachCell((cell) => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: colorFondo }
                    };
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                });
                
                // Formato de números
                row.getCell(5).numFmt = '#,##0.00';   // Cantidad
                row.getCell(6).numFmt = '#,##0.00';   // Bonificación
                row.getCell(7).numFmt = 'Q#,##0.00';  // Costo
                row.getCell(8).numFmt = 'Q#,##0.00';  // Precio
                if (item.saldo !== null) {
                    row.getCell(15).numFmt = '#,##0.00';  // Saldo
                }
            });
        }
        
        // Actualizar mensaje
        Swal.update({
            title: 'Finalizando...',
            html: '💾 Guardando archivo Excel...'
        });
        
        // ⚡ Pequeño delay antes de generar el buffer
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Generar el archivo
        const buffer = await workbook.xlsx.writeBuffer();
        
        // Crear un blob y descargar
        const blob = new Blob([buffer], { 
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        });
        
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        // Nombre del archivo con fecha
        const nombreArchivo = `Kardex_${new Date().toISOString().split('T')[0]}.xlsx`;
        link.download = nombreArchivo;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        Swal.close();
        
        mostrarExito(`Archivo Excel generado exitosamente con ${datosKardexActuales.length} hoja(s)`);
        
    } catch (error) {
        console.error('Error al exportar a Excel:', error);
        Swal.close();
        mostrarError('Error al generar el archivo Excel: ' + error.message);
    }
}
function formatearFechaExcel(fechaString) {
    if (!fechaString) return '';
    
    // fechaString viene en formato YYYY-MM-DD
    const partes = fechaString.split('-');
    if (partes.length !== 3) return fechaString;
    
    const anio = partes[0];
    const mes = partes[1];
    const dia = partes[2];
    
    return `${dia}/${mes}/${anio}`;
}
async function obtenerNotasCreditoCompras(upc, fechaInicio, fechaFin, idRazon) {
    let connection;
    const datos = [];
    
    try {
        connection = await mysql.createConnection(conexionNotasCompras);
        
        const query = `
            SELECT
                NCTProveedores.IdNotaCreditoProveedores,
                NCTProveedoresDetalle.Upc, 
                NCTProveedoresDetalle.Descripcion, 
                NCTProveedoresDetalle.Cantidad, 
                NCTProveedoresDetalle.IdRazonSocial, 
                NCTProveedoresDetalle.RazonSocial, 
                NCTProveedores.Serie, 
                NCTProveedores.Numero, 
                NCTProveedores.FechaNotaCredito
            FROM
                NCTProveedoresDetalle
                INNER JOIN
                NCTProveedores
                ON 
                    NCTProveedoresDetalle.IdNTCProveedor = NCTProveedores.IdNotaCreditoProveedores
            WHERE
                NCTProveedoresDetalle.Upc = ? AND
                NCTProveedoresDetalle.IdRazonSocial = ? AND
                NCTProveedores.FechaNotaCredito BETWEEN ? AND ?
            ORDER BY
                NCTProveedores.FechaNotaCredito
        `;
        
        const [notasCompras] = await connection.execute(query, [upc, idRazon, fechaInicio, fechaFin]);
        
        notasCompras.forEach(nota => {
            datos.push({
                idTransaccion: nota.IdNotaCreditoProveedores,
                upc: nota.Upc,
                descripcion: nota.Descripcion,
                descripcionCorta: '',
                cantidad: nota.Cantidad,
                bonificacion: '',
                costo: '',
                precio: '',
                fechaRecepcion: nota.FechaNotaCredito,
                fechaFactura: '',
                serie: nota.Serie,
                numero: nota.Numero,
                uuid: '',
                sucursal: '',
                fechaOrden: nota.FechaNotaCredito,
                tipoMovimiento: 'NOTA_CREDITO_COMPRA',
                afectaSaldo: true
            });
        });
        
        await connection.end();
        
    } catch (error) {
        console.error('Error al obtener notas de crédito de compras:', error);
        if (connection) await connection.end();
        // No lanzar error, simplemente retornar array vacío
    }
    
    return datos;
}
// ===== OBTENER FACTURAS CORI =====
async function obtenerFacturasCORI(upc, fechaInicio, fechaFin, idRazon) {
    let connection;
    const datos = [];
    
    try {
        connection = await mysql.createConnection(conexionNotasCompras);
        
        // Consultar facturas donde la razón social es VENDEDOR (RESTA)
        const queryVentas = `
            SELECT
                factura_inventario.Id, 
                factura_inventario.IdCaja, 
                detalle_facturainventario.UPC, 
                detalle_facturainventario.Descripcion, 
                detalle_facturainventario.Cantidad, 
                detalle_facturainventario.Costo, 
                detalle_facturainventario.Precio, 
                factura_inventario.IdRazonSocialEmpresa, 
                factura_inventario.NombreEmpresa, 
                factura_inventario.IdRazonSocialCliente, 
                factura_inventario.NombreCliente, 
                factura_inventario.Serie, 
                factura_inventario.Numero, 
                factura_inventario.UID, 
                factura_inventario.FechaCertificacion
            FROM
                detalle_facturainventario
                INNER JOIN
                factura_inventario
                ON 
                    detalle_facturainventario.IdFactura = factura_inventario.Id
            WHERE
                detalle_facturainventario.UPC = ? AND
                factura_inventario.IdRazonSocialEmpresa = ? AND
                factura_inventario.FechaCertificacion BETWEEN ? AND ?
            ORDER BY
                factura_inventario.FechaCertificacion
        `;
        
        const [ventasCORI] = await connection.execute(queryVentas, [upc, idRazon, fechaInicio, fechaFin]);
        
        ventasCORI.forEach(venta => {
            datos.push({
                idTransaccion: venta.Id,
                upc: venta.UPC,
                descripcion: venta.Descripcion,
                descripcionCorta: '',
                cantidad: venta.Cantidad,
                bonificacion: '',
                costo: venta.Costo,
                precio: venta.Precio,
                fechaRecepcion: venta.FechaCertificacion,
                fechaFactura: venta.FechaCertificacion,
                serie: venta.Serie,
                numero: venta.Numero,
                uuid: venta.UID,
                sucursal: '',
                fechaOrden: venta.FechaCertificacion,
                tipoMovimiento: 'VENTA_CORI',
                afectaSaldo: true
            });
        });
        
        // Consultar facturas donde la razón social es COMPRADOR (SUMA)
        const queryCompras = `
            SELECT
                factura_inventario.Id, 
                factura_inventario.IdCaja, 
                detalle_facturainventario.UPC, 
                detalle_facturainventario.Descripcion, 
                detalle_facturainventario.Cantidad, 
                detalle_facturainventario.Costo, 
                detalle_facturainventario.Precio, 
                factura_inventario.IdRazonSocialEmpresa, 
                factura_inventario.NombreEmpresa, 
                factura_inventario.IdRazonSocialCliente, 
                factura_inventario.NombreCliente, 
                factura_inventario.Serie, 
                factura_inventario.Numero, 
                factura_inventario.UID, 
                factura_inventario.FechaCertificacion
            FROM
                detalle_facturainventario
                INNER JOIN
                factura_inventario
                ON 
                    detalle_facturainventario.IdFactura = factura_inventario.Id
            WHERE
                detalle_facturainventario.UPC = ? AND
                factura_inventario.IdRazonSocialCliente = ? AND
                factura_inventario.FechaCertificacion BETWEEN ? AND ?
            ORDER BY
                factura_inventario.FechaCertificacion
        `;
        
        const [comprasCORI] = await connection.execute(queryCompras, [upc, idRazon, fechaInicio, fechaFin]);
        
        comprasCORI.forEach(compra => {
            datos.push({
                idTransaccion: compra.Id,
                upc: compra.UPC,
                descripcion: compra.Descripcion,
                descripcionCorta: '',
                cantidad: compra.Cantidad,
                bonificacion: '',
                costo: compra.Costo,
                precio: compra.Precio,
                fechaRecepcion: compra.FechaCertificacion,
                fechaFactura: compra.FechaCertificacion,
                serie: compra.Serie,
                numero: compra.Numero,
                uuid: compra.UID,
                sucursal: '',
                fechaOrden: compra.FechaCertificacion,
                tipoMovimiento: 'COMPRA_CORI',
                afectaSaldo: true
            });
        });
        
        await connection.end();
        
    } catch (error) {
        console.error('Error al obtener facturas CORI:', error);
        if (connection) await connection.end();
        // No lanzar error, simplemente retornar array vacío
    }
    
    return datos;
}
// ===== OBTENER FACTURAS MANUALES FEL =====
async function obtenerFacturasManualesFEL(connection, upc, fechaInicio, fechaFin, idRazon) {
    const datos = [];
    
    try {
        // Consultar facturas donde la razón social es VENDEDOR (RESTA)
        const queryVentas = `
            SELECT
                FacturasManualesFELDetalle.Upc, 
                FacturasManualesFELDetalle.Descripcion, 
                FacturasManualesFELDetalle.Cantidad, 
                FacturasManualesFELDetalle.Costo, 
                FacturasManualesFELDetalle.Precio, 
                FacturasManualesFEL.IdFacturasVentasCompras, 
                FacturasManualesFEL.NombreSucursal, 
                FacturasManualesFEL.RazonSocial, 
                FacturasManualesFEL.SucursalCliente, 
                FacturasManualesFEL.RazonSocialCliente, 
                FacturasManualesFEL.FechaFactura, 
                FacturasManualesFEL.Serie, 
                FacturasManualesFEL.NoDocumento, 
                FacturasManualesFEL.IdRazonSocial, 
                FacturasManualesFEL.IdRazonSocialCliente
            FROM
                FacturasManualesFELDetalle
                INNER JOIN
                FacturasManualesFEL
                ON 
                    FacturasManualesFELDetalle.IdFacturasVentasCompras = FacturasManualesFEL.IdFacturasVentasCompras
            WHERE
                FacturasManualesFELDetalle.Upc = ? AND
                FacturasManualesFEL.IdRazonSocial = ? AND
                FacturasManualesFEL.FechaFactura BETWEEN ? AND ?
            ORDER BY
                FacturasManualesFEL.FechaFactura
        `;
        
        const [ventasFEL] = await connection.execute(queryVentas, [upc, idRazon, fechaInicio, fechaFin]);
        
        ventasFEL.forEach(venta => {
            datos.push({
                idTransaccion: venta.IdFacturasVentasCompras,
                upc: venta.Upc,
                descripcion: venta.Descripcion,
                descripcionCorta: '',
                cantidad: venta.Cantidad,
                bonificacion: '',
                costo: venta.Costo,
                precio: venta.Precio,
                fechaRecepcion: venta.FechaFactura,
                fechaFactura: venta.FechaFactura,
                serie: venta.Serie,
                numero: venta.NoDocumento,
                uuid: '',
                sucursal: venta.NombreSucursal,
                fechaOrden: venta.FechaFactura,
                tipoMovimiento: 'VENTA_FEL',
                afectaSaldo: true
            });
        });
        
        // Consultar facturas donde la razón social es COMPRADOR (SUMA)
        const queryCompras = `
            SELECT
                FacturasManualesFELDetalle.Upc, 
                FacturasManualesFELDetalle.Descripcion, 
                FacturasManualesFELDetalle.Cantidad, 
                FacturasManualesFELDetalle.Costo, 
                FacturasManualesFELDetalle.Precio, 
                FacturasManualesFEL.IdFacturasVentasCompras, 
                FacturasManualesFEL.NombreSucursal, 
                FacturasManualesFEL.RazonSocial, 
                FacturasManualesFEL.SucursalCliente, 
                FacturasManualesFEL.RazonSocialCliente, 
                FacturasManualesFEL.FechaFactura, 
                FacturasManualesFEL.Serie, 
                FacturasManualesFEL.NoDocumento, 
                FacturasManualesFEL.IdRazonSocial, 
                FacturasManualesFEL.IdRazonSocialCliente
            FROM
                FacturasManualesFELDetalle
                INNER JOIN
                FacturasManualesFEL
                ON 
                    FacturasManualesFELDetalle.IdFacturasVentasCompras = FacturasManualesFEL.IdFacturasVentasCompras
            WHERE
                FacturasManualesFELDetalle.Upc = ? AND
                FacturasManualesFEL.IdRazonSocialCliente = ? AND
                FacturasManualesFEL.FechaFactura BETWEEN ? AND ?
            ORDER BY
                FacturasManualesFEL.FechaFactura
        `;
        
        const [comprasFEL] = await connection.execute(queryCompras, [upc, idRazon, fechaInicio, fechaFin]);
        
        comprasFEL.forEach(compra => {
            datos.push({
                idTransaccion: compra.IdFacturasVentasCompras,
                upc: compra.Upc,
                descripcion: compra.Descripcion,
                descripcionCorta: '',
                cantidad: compra.Cantidad,
                bonificacion: '',
                costo: compra.Costo,
                precio: compra.Precio,
                fechaRecepcion: compra.FechaFactura,
                fechaFactura: compra.FechaFactura,
                serie: compra.Serie,
                numero: compra.NoDocumento,
                uuid: '',
                sucursal: compra.SucursalCliente,
                fechaOrden: compra.FechaFactura,
                tipoMovimiento: 'COMPRA_FEL',
                afectaSaldo: true
            });
        });
        
    } catch (error) {
        console.error('Error al obtener facturas manuales FEL:', error);
        // No lanzar error, simplemente retornar array vacío
    }
    
    return datos;
}
// ===== LIMPIEZA AL CERRAR =====
window.addEventListener('beforeunload', async () => {
    if (connectionPool) {
        await connectionPool.end();
    }
});