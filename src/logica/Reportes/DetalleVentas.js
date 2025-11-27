const Swal = require('sweetalert2');
const mysql = require('mysql2/promise');
const ExcelJS = require('exceljs');
const path = require('path');

// Configuración de conexión
const dbConfig = {
    host: '172.30.1.17',
    database: 'Gestion',
    user: 'compras',
    password: 'bode.24451988',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    multipleStatements: false,
    namedPlaceholders: false,
    typeCast: true,
    bigNumberStrings: false,
    supportBigNumbers: true,
    dateStrings: true
};
let pool;

// Variables globales
let todosLosDatos = []; // Array con TODOS los registros cargados
let filtrosActuales = {};
let virtualScroller = null;
let origenActual = ''; // 'megared', 'bodegona' o 'surti'

// Inicializar pool
function inicializarPool() {
    pool = mysql.createPool(dbConfig);
}

async function cargarSucursales() {
    const selectSucursal = document.getElementById('sucursal');
    
    try {
        const connection = await pool.getConnection();
        
        const [sucursales] = await connection.query(
            'SELECT idSucursal, NombreSucursal FROM sucursales WHERE RazonSocial = 2 AND Activo = 1 ORDER BY NombreSucursal'
        );
        
        connection.release();
        
        selectSucursal.innerHTML = '<option value="0">Todas las Sucursales</option>';
        
        sucursales.forEach(sucursal => {
            const option = document.createElement('option');
            option.value = sucursal.idSucursal;
            option.textContent = sucursal.NombreSucursal;
            selectSucursal.appendChild(option);
        });
        
    } catch (error) {
        console.error('Error al cargar sucursales:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudieron cargar las sucursales: ' + error.message
        });
    }
}

async function contarRegistros(fechaInicio, fechaFin, idSucursal, upc, origen) {
    const connection = await pool.getConnection();
    
    let tabla = '';
    if (origen === 'megared') tabla = 'ventasmegared';
    else if (origen === 'bodegona') tabla = 'ventasbodegonaantigua';
    else if (origen === 'surti') tabla = 'ventassurtimayoreo';
    
    let query = `SELECT COUNT(*) as total FROM ${tabla} WHERE Fecha BETWEEN ? AND ?`;
    const params = [fechaInicio, fechaFin];
    
    if (idSucursal !== '0') {
        query += ' AND IdSucursal = ?';
        params.push(idSucursal);
    }
    
    if (upc) {
        query += ' AND Upc = ?';
        params.push(upc);
    }
    
    const [resultado] = await connection.query(query, params);
    connection.release();
    
    return resultado[0].total;
}

// ========================================
// 🚀 FUNCIÓN PRINCIPAL DE BÚSQUEDA
// ========================================
async function buscarVentas(origen) {
    const fechaInicio = document.getElementById('fechaInicio').value;
    const fechaFin = document.getElementById('fechaFin').value;
    const idSucursal = document.getElementById('sucursal').value;
    const upc = document.getElementById('upc').value.trim();
    
    if (!fechaInicio || !fechaFin) {
        Swal.fire({
            icon: 'warning',
            title: 'Campos requeridos',
            text: 'Por favor seleccione el rango de fechas'
        });
        return;
    }
    
    if (new Date(fechaInicio) > new Date(fechaFin)) {
        Swal.fire({
            icon: 'warning',
            title: 'Rango inválido',
            text: 'La fecha de inicio no puede ser mayor a la fecha fin'
        });
        return;
    }
    
    origenActual = origen;
    filtrosActuales = { fechaInicio, fechaFin, idSucursal, upc, origen };
    
    mostrarLoading(true, 'Contando registros...');
    
    try {
        // Contar total de registros
        const totalRegistros = await contarRegistros(fechaInicio, fechaFin, idSucursal, upc, origen);
        
        console.log(`📊 Total registros a cargar: ${totalRegistros.toLocaleString()}`);
        
        // ⚠️ VALIDACIÓN: NO PERMITIR MÁS DE 2.8M REGISTROS
        if (totalRegistros > 2800000) {
            mostrarLoading(false);
            
            await Swal.fire({
                icon: 'error',
                title: '🚫 Consulta no permitida',
                html: `
                    <div style="text-align: left;">
                        <p>La consulta contiene <strong style="color: #e53e3e;">${totalRegistros.toLocaleString()}</strong> registros.</p>
                        <p style="margin-top: 15px;">❌ <strong>Límite máximo:</strong> 2,800,000 registros</p>
                        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e2e8f0;">
                        <p style="font-weight: 600; color: #2d3748;">💡 Opciones para continuar:</p>
                        <ul style="text-align: left; margin-top: 10px; line-height: 1.8;">
                            <li>📅 <strong>Reduzca el rango de fechas</strong> (ej: buscar por semanas o meses)</li>
                            <li>🔍 <strong>Filtre por UPC específico</strong> para obtener datos de un producto</li>
                            <li>🏪 <strong>Seleccione una sucursal específica</strong> en lugar de "Todas"</li>
                        </ul>
                    </div>
                `,
                width: 550,
                confirmButtonText: 'Entendido'
            });
            
            return;
        }
        
        if (totalRegistros === 0) {
            mostrarLoading(false);
            todosLosDatos = [];
            mostrarResultados();
            document.getElementById('btnExportar').style.display = 'none';
            return;
        }
        
        // Advertencia si hay muchos registros (pero dentro del límite)
        if (totalRegistros > 1000000) {
            const result = await Swal.fire({
                title: '⚠️ Gran volumen de datos',
                html: `
                    <p>Se encontraron <strong>${totalRegistros.toLocaleString()}</strong> registros.</p>
                `,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Sí, cargar todos',
                cancelButtonText: 'Cancelar'
            });
            
            if (!result.isConfirmed) {
                mostrarLoading(false);
                return;
            }
        }
        
        // Limpiar datos anteriores
        todosLosDatos = [];
        
        // ⚡ CARGAR TODO EN UNA SOLA QUERY
        mostrarLoading(true, '⚡ Ejecutando consulta...');
        await cargarTodoDeUnaVez(fechaInicio, fechaFin, idSucursal, upc, totalRegistros, origen);
        
        // Mostrar resultados con virtualización
        mostrarResultados();
        
        document.getElementById('btnExportar').style.display = todosLosDatos.length > 0 ? 'flex' : 'none';
        
    } catch (error) {
        console.error('Error al buscar ventas:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error en la búsqueda',
            text: 'No se pudieron obtener los datos: ' + error.message
        });
    } finally {
        mostrarLoading(false);
    }
}

async function cargarTodoDeUnaVez(fechaInicio, fechaFin, idSucursal, upc, totalRegistros, origen) {
    const connection = await pool.getConnection();
    
    const tiempoInicio = Date.now();
    
    try {
        let query = '';
        const params = [fechaInicio, fechaFin];
        
        // Construir query según el origen
        if (origen === 'megared' || origen === 'bodegona') {
            const tabla = origen === 'megared' ? 'ventasmegared' : 'ventasbodegonaantigua';
            query = `
                SELECT
                    DATE_FORMAT(Fecha, '%Y-%m-%d') as Fecha,
                    NombreSucursal,
                    IdTransaccion, 
                    IdCaja, 
                    Upc, 
                    Descripcion, 
                    DescCorta, 
                    Cantidad, 
                    CostoUnitario, 
                    PrecioUnitario, 
                    Total, 
                    NIT, 
                    NombreCliente, 
                    Serie, 
                    NoDocumento, 
                    UUID,
                    IdSucursal
                FROM ${tabla}
                WHERE Fecha BETWEEN ? AND ?
            `;
        } else if (origen === 'surti') {
            // SurtiMayoreo tiene columnas diferentes
            query = `
                SELECT
                    DATE_FORMAT(Fecha, '%Y-%m-%d') as Fecha,
                    NombreSucursal,
                    IdTransaccion,
                    NULL as IdCaja,
                    Upc,
                    Descripcion,
                    NULL as DescCorta,
                    Cantidad,
                    Costo as CostoUnitario,
                    Precio as PrecioUnitario,
                    (Cantidad * Precio) as Total,
                    NIT,
                    NombreCliente,
                    Serie,
                    NoDocumento,
                    UUID,
                    IdSucursal
                FROM ventassurtimayoreo
                WHERE Fecha BETWEEN ? AND ?
            `;
        }
        
        if (idSucursal !== '0') {
            query += ' AND IdSucursal = ?';
            params.push(idSucursal);
        }
        
        if (upc) {
            query += ' AND Upc = ?';
            params.push(upc);
        }
        
        query += ' ORDER BY Fecha ASC, IdTransaccion DESC';
        
        // Ejecutar la consulta completa
        const startQuery = performance.now();
        const [datos] = await connection.query(query, params);
        const endQuery = performance.now();
        
        const tiempoQuery = ((endQuery - startQuery) / 1000).toFixed(2);
        
        // Asignar todos los datos de una vez
        todosLosDatos = datos;
        
        const tiempoTotal = ((Date.now() - tiempoInicio) / 1000).toFixed(2);
        const velocidadPromedio = Math.round(datos.length / (Date.now() - tiempoInicio) * 1000);
        
    } catch (error) {
        console.error('❌ Error en query:', error);
        throw error;
    } finally {
        connection.release();
    }
}

// ========================================
// 🎨 VIRTUALIZACIÓN - RENDERIZA SOLO LO VISIBLE
// ========================================
function mostrarResultados() {
    const tbody = document.getElementById('tablaBody');
    const totalRegistrosEl = document.getElementById('totalRegistros');
    const rangoFechas = document.getElementById('rangoFechas');
    const origenDatos = document.getElementById('origenDatos');
    
    // Mostrar origen de datos
    let nombreOrigen = '';
    let colorOrigen = '';
    
    if (origenActual === 'megared') {
        nombreOrigen = '🔵 Megared';
        colorOrigen = '#3182ce';
    } else if (origenActual === 'bodegona') {
        nombreOrigen = '🔴 Bodegona Antigua';
        colorOrigen = '#e53e3e';
    } else if (origenActual === 'surti') {
        nombreOrigen = '🟢 SurtiMayoreo';
        colorOrigen = '#38a169';
    }
    
    origenDatos.textContent = nombreOrigen;
    origenDatos.style.color = colorOrigen;
    
    totalRegistrosEl.textContent = `Total de registros: ${todosLosDatos.length.toLocaleString()}`;
    rangoFechas.textContent = `Rango: ${formatearFecha(filtrosActuales.fechaInicio)} - ${formatearFecha(filtrosActuales.fechaFin)}`;
    
    tbody.innerHTML = '';
    
    if (todosLosDatos.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="16" class="sin-datos">
                    No se encontraron resultados para los filtros seleccionados
                </td>
            </tr>
        `;
        origenDatos.textContent = '';
        return;
    }
    
    // Destruir virtualScroller anterior si existe
    if (virtualScroller) {
        virtualScroller.destroy();
    }
    
    // Crear nuevo VirtualScroller
    virtualScroller = new VirtualScroller({
        container: tbody,
        data: todosLosDatos,
        rowHeight: 35,
        bufferSize: 10
    });
}

// ========================================
// 📜 CLASE DE VIRTUALIZACIÓN (CORREGIDA)
// ========================================
class VirtualScroller {
    constructor(options) {
        this.container = options.container;
        this.data = options.data;
        this.rowHeight = options.rowHeight || 35;
        this.bufferSize = options.bufferSize || 10;
        
        this.scrollContainer = this.container.parentElement;
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
    
    createRow(v) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${v.Fecha || ''}</td>
            <td>${v.NombreSucursal || ''}</td>
            <td>${v.IdTransaccion || ''}</td>
            <td>${v.IdCaja || '-'}</td>
            <td>${v.Upc || ''}</td>
            <td title="${escapeHtml(v.Descripcion)}">${truncar(v.Descripcion, 30)}</td>
            <td>${v.DescCorta || '-'}</td>
            <td>${formatearNumero(v.Cantidad)}</td>
            <td>Q ${formatearNumero(v.CostoUnitario)}</td>
            <td>Q ${formatearNumero(v.PrecioUnitario)}</td>
            <td>Q ${formatearNumero(v.Total)}</td>
            <td>${v.NIT || ''}</td>
            <td title="${escapeHtml(v.NombreCliente)}">${truncar(v.NombreCliente, 25)}</td>
            <td>${v.Serie || ''}</td>
            <td>${v.NoDocumento || ''}</td>
            <td title="${escapeHtml(v.UUID)}">${truncar(v.UUID, 20)}</td>
        `;
        
        return tr;
    }
    
    destroy() {
        if (this.scrollContainer && this.handleScroll) {
            this.scrollContainer.removeEventListener('scroll', this.handleScroll);
        }
        this.currentRows = [];
    }
}

// ========================================
// 📊 EXPORTACIÓN
// ========================================
async function exportarExcel() {
    let nombreOrigen = '';
    if (origenActual === 'megared') nombreOrigen = 'Megared';
    else if (origenActual === 'bodegona') nombreOrigen = 'BodegonaAntigua';
    else if (origenActual === 'surti') nombreOrigen = 'SurtiMayoreo';
    
    const result = await Swal.fire({
        title: 'Exportar a Excel',
        html: `
            <p>Se exportarán <strong>${todosLosDatos.length.toLocaleString()}</strong> registros de <strong>${nombreOrigen}</strong>.</p>
            ${todosLosDatos.length > 1000000 ? '<p style="color: #e53e3e;">📋 Se crearán múltiples hojas (1M registros por hoja)</p>' : ''}
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, exportar',
        cancelButtonText: 'Cancelar'
    });
    
    if (!result.isConfirmed) return;
    
    mostrarLoading(true, 'Iniciando exportación...');
    
    try {
        const REGISTROS_POR_HOJA = 1000000;
        const BATCH_WRITE_SIZE = 5000;
        
        const fecha = new Date().toISOString().split('T')[0];
        const nombreArchivo = `Ventas${nombreOrigen}_${fecha}_${Date.now()}.xlsx`;
        const rutaArchivo = path.join(require('os').homedir(), 'Downloads', nombreArchivo);
        
        const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
            filename: rutaArchivo,
            useStyles: true,
            useSharedStrings: false
        });
        
        const totalHojas = Math.ceil(todosLosDatos.length / REGISTROS_POR_HOJA);
        console.log(`🚀 Exportando ${todosLosDatos.length.toLocaleString()} registros en ${totalHojas} hoja(s)`);
        
        const tiempoInicio = Date.now();
        let registrosProcesados = 0;
        let hojaActual = 1;
        let worksheet = null;
        let filasEnHojaActual = 0;
        let buffer = [];
        
        const crearNuevaHoja = () => {
            const nombreHoja = totalHojas > 1 ? `Ventas ${hojaActual}` : `Ventas ${nombreOrigen}`;
            worksheet = workbook.addWorksheet(nombreHoja, {
                views: [{ state: 'frozen', ySplit: 1 }]
            });
            
            worksheet.columns = [
                { header: 'Fecha', key: 'Fecha', width: 12 },
                { header: 'Sucursal', key: 'NombreSucursal', width: 20 },
                { header: 'Id Transacción', key: 'IdTransaccion', width: 15 },
                { header: 'Caja', key: 'IdCaja', width: 10 },
                { header: 'UPC', key: 'Upc', width: 15 },
                { header: 'Descripción', key: 'Descripcion', width: 40 },
                { header: 'Desc. Corta', key: 'DescCorta', width: 20 },
                { header: 'Cantidad', key: 'Cantidad', width: 12 },
                { header: 'Costo Unitario', key: 'CostoUnitario', width: 15 },
                { header: 'Precio Unitario', key: 'PrecioUnitario', width: 15 },
                { header: 'Total', key: 'Total', width: 15 },
                { header: 'NIT', key: 'NIT', width: 15 },
                { header: 'Cliente', key: 'NombreCliente', width: 30 },
                { header: 'Serie', key: 'Serie', width: 10 },
                { header: 'No. Documento', key: 'NoDocumento', width: 15 },
                { header: 'UUID', key: 'UUID', width: 40 }
            ];
            
            worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            worksheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF4472C4' }
            };
            worksheet.getRow(1).commit();
            
            filasEnHojaActual = 0;
            console.log(`✓ Hoja ${hojaActual} creada`);
        };
        
        const flushBuffer = async () => {
            if (buffer.length === 0) return;
            
            for (const row of buffer) {
                worksheet.addRow(row).commit();
            }
            
            buffer = [];
            await new Promise(resolve => setImmediate(resolve));
        };
        
        crearNuevaHoja();
        
        // Procesar datos en memoria
        for (const row of todosLosDatos) {
            if (filasEnHojaActual >= REGISTROS_POR_HOJA) {
                await flushBuffer();
                await worksheet.commit();
                console.log(`✓ Hoja ${hojaActual} completada: ${filasEnHojaActual.toLocaleString()} registros`);
                hojaActual++;
                crearNuevaHoja();
            }
            
            buffer.push(row);
            filasEnHojaActual++;
            registrosProcesados++;
            
            if (buffer.length >= BATCH_WRITE_SIZE) {
                await flushBuffer();
                
                const porcentaje = Math.round((registrosProcesados / todosLosDatos.length) * 100);
                mostrarLoading(true, `📊 Exportando ${porcentaje}% | ${registrosProcesados.toLocaleString()}/${todosLosDatos.length.toLocaleString()}`);
            }
        }
        
        await flushBuffer();
        
        if (worksheet) {
            await worksheet.commit();
            console.log(`✓ Hoja ${hojaActual} completada: ${filasEnHojaActual.toLocaleString()} registros`);
        }
        
        mostrarLoading(true, '💾 Guardando archivo Excel...');
        await workbook.commit();
        
        const tiempoTotal = ((Date.now() - tiempoInicio) / 1000).toFixed(1);
        const velocidadPromedio = Math.round(registrosProcesados / (Date.now() - tiempoInicio) * 1000);
        
        mostrarLoading(false);
        
        Swal.fire({
            icon: 'success',
            title: '✅ Exportación completada',
            html: `
                <div style="text-align: left;">
                    <p>📊 <strong>Registros exportados:</strong> ${registrosProcesados.toLocaleString()}</p>
                    <p>📄 <strong>Hojas creadas:</strong> ${hojaActual}</p>
                    <p>🏢 <strong>Origen:</strong> ${nombreOrigen}</p>
                    <p>📁 <strong>Archivo guardado en:</strong></p>
                    <p style="font-size: 11px; color: #666; word-break: break-all; background: #f5f5f5; padding: 8px; border-radius: 4px; margin-top: 8px;">${rutaArchivo}</p>
                </div>
            `,
            width: 600
        });
        
    } catch (error) {
        console.error('❌ Error al exportar:', error);
        mostrarLoading(false);
        
        Swal.fire({
            icon: 'error',
            title: 'Error al exportar',
            text: error.message
        });
    }
}

function estimarTiempo(registros) {
    const segundos = Math.ceil(registros / 50000);
    if (segundos < 60) return `~${segundos} segundos`;
    if (segundos < 3600) return `~${Math.ceil(segundos / 60)} minutos`;
    return `~${(segundos / 3600).toFixed(1)} horas`;
}

function estimarTiempoCarga(registros) {
    const segundos = Math.ceil(registros / 150000);
    if (segundos < 60) return `~${segundos} segundos`;
    return `~${Math.ceil(segundos / 60)} minutos`;
}

function formatearFecha(fecha) {
    if (!fecha) return '';
    const date = new Date(fecha + 'T00:00:00');
    return date.toLocaleDateString('es-GT', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
    });
}

function formatearNumero(numero) {
    if (numero === null || numero === undefined) return '0.00';
    return parseFloat(numero).toFixed(2);
}

function truncar(texto, longitud) {
    if (!texto) return '';
    return texto.length > longitud ? texto.substring(0, longitud) + '...' : texto;
}

function escapeHtml(texto) {
    if (!texto) return '';
    return texto.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function mostrarLoading(mostrar, mensaje = 'Cargando datos...') {
    const overlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');
    
    if (loadingText) {
        loadingText.textContent = mensaje;
    }
    
    overlay.style.display = mostrar ? 'flex' : 'none';
}

function establecerFechasPorDefecto() {
    const hoy = new Date();
    const hace7dias = new Date(hoy);
    hace7dias.setDate(hoy.getDate() - 7);
    
    document.getElementById('fechaInicio').valueAsDate = hace7dias;
    document.getElementById('fechaFin').valueAsDate = hoy;
}

// Eventos
document.addEventListener('DOMContentLoaded', () => {
    inicializarPool();
    establecerFechasPorDefecto();
    cargarSucursales();
    
    // Botones de búsqueda
    document.getElementById('btnBuscarMegared').addEventListener('click', () => buscarVentas('megared'));
    document.getElementById('btnBuscarBodegona').addEventListener('click', () => buscarVentas('bodegona'));
    document.getElementById('btnBuscarSurti').addEventListener('click', () => buscarVentas('surti'));
    
    // Botón de exportar
    document.getElementById('btnExportar').addEventListener('click', exportarExcel);
    
    // Enter en campos
    ['fechaInicio', 'fechaFin', 'upc'].forEach(id => {
        document.getElementById(id).addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                // Por defecto buscar en Megared cuando se presiona Enter
                buscarVentas('megared');
            }
        });
    });
});

window.addEventListener('beforeunload', async () => {
    if (pool) {
        await pool.end();
    }
});