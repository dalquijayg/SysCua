const mysql = require('mysql2/promise');
const Swal = require('sweetalert2');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const os = require('os');
// Variables globales
let conexionGestion = null;
let datosFacturas = [];
let datosFiltrados = [];
let paginaActual = 1;
let registrosPorPagina = 50;

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    inicializarApp();
});

function inicializarApp() {
    cargarUsuario();
    configurarFechasDefault();
    configurarEventos();
}

// Cargar información del usuario
function cargarUsuario() {
    const userName = localStorage.getItem('userName');
    if (userName) {
        document.getElementById('userName').textContent = userName;
    }
}

// Configurar fechas por defecto (mes actual)
function configurarFechasDefault() {
    const hoy = new Date();
    const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    
    document.getElementById('fechaDesde').value = primerDia.toISOString().split('T')[0];
    document.getElementById('fechaHasta').value = hoy.toISOString().split('T')[0];
}

// Configurar eventos
function configurarEventos() {
    // Botón buscar
    document.getElementById('btnBuscar').addEventListener('click', buscarFacturas);
    
    // Botón limpiar filtros
    document.getElementById('btnLimpiar').addEventListener('click', limpiarFiltros);
    
    // Botón exportar
    document.getElementById('btnExportar').addEventListener('click', exportarExcel);
    
    // Enter en campos de filtro
    document.getElementById('fechaDesde').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') buscarFacturas();
    });
    
    document.getElementById('fechaHasta').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') buscarFacturas();
    });
    
    document.getElementById('filtroSucursal').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') buscarFacturas();
    });
    
    // Cerrar modal
    document.getElementById('btnCerrarModal').addEventListener('click', cerrarModal);
    document.getElementById('btnCerrar').addEventListener('click', cerrarModal);
    
    // Cerrar modal al hacer clic fuera
    document.getElementById('modalDetalle').addEventListener('click', (e) => {
        if (e.target.id === 'modalDetalle') {
            cerrarModal();
        }
    });
    
    // Paginación
    document.getElementById('btnPrimera').addEventListener('click', () => irAPagina(1));
    document.getElementById('btnAnterior').addEventListener('click', () => irAPagina(paginaActual - 1));
    document.getElementById('btnSiguiente').addEventListener('click', () => irAPagina(paginaActual + 1));
    document.getElementById('btnUltima').addEventListener('click', () => {
        const totalPaginas = Math.ceil(datosFiltrados.length / registrosPorPagina);
        irAPagina(totalPaginas);
    });
}

// Limpiar filtros
function limpiarFiltros() {
    configurarFechasDefault();
    document.getElementById('filtroTipo').value = '';
    document.getElementById('filtroSucursal').value = '';
}

// ==================== BÚSQUEDA DE FACTURAS ====================

async function buscarFacturas() {
    const fechaDesde = document.getElementById('fechaDesde').value;
    const fechaHasta = document.getElementById('fechaHasta').value;
    
    // Validar fechas
    if (!fechaDesde || !fechaHasta) {
        Swal.fire({
            icon: 'warning',
            title: 'Fechas requeridas',
            text: 'Por favor selecciona un rango de fechas',
            confirmButtonColor: '#6e78ff'
        });
        return;
    }
    
    if (new Date(fechaDesde) > new Date(fechaHasta)) {
        Swal.fire({
            icon: 'warning',
            title: 'Fechas inválidas',
            text: 'La fecha "Desde" no puede ser mayor que la fecha "Hasta"',
            confirmButtonColor: '#6e78ff'
        });
        return;
    }
    
    // Mostrar loading
    Swal.fire({
        title: 'Buscando facturas...',
        html: 'Por favor espera mientras se cargan los datos',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });
    
    try {
        // Conectar a la base de datos
        await conectarBaseDatos();
        
        // Construir query con filtros
        let query = `
            SELECT 
                IdFacturasVentasCompras,
                IdSucusal,
                NombreSucursal,
                IdRazonSocial,
                RazonSocial,
                IdSucursalCliente,
                SucursalCliente,
                IdRazonSocialCliente,
                RazonSocialCliente,
                FechaFactura,
                Serie,
                NoDocumento,
                Total,
                TipoFactura,
                IdUsuario,
                NombreUsuario,
                FechaHoraRegistro
            FROM FacturasManualesFEL
            WHERE FechaFactura BETWEEN ? AND ?
        `;
        
        const params = [fechaDesde, fechaHasta];
        
        // Filtro por tipo
        const filtroTipo = document.getElementById('filtroTipo').value;
        if (filtroTipo) {
            query += ` AND TipoFactura = ?`;
            params.push(filtroTipo);
        }
        
        // Filtro por sucursal
        const filtroSucursal = document.getElementById('filtroSucursal').value.trim();
        if (filtroSucursal) {
            query += ` AND (NombreSucursal LIKE ? OR SucursalCliente LIKE ?)`;
            params.push(`%${filtroSucursal}%`, `%${filtroSucursal}%`);
        }
        
        query += ` ORDER BY FechaFactura DESC, IdFacturasVentasCompras DESC`;
        
        // Ejecutar query
        const [results] = await conexionGestion.query(query, params);
        
        datosFacturas = results;
        datosFiltrados = results;
        
        // Cargar productos de todas las facturas
        if (results.length > 0) {
            const ids = results.map(f => f.IdFacturasVentasCompras);
            const [productos] = await conexionGestion.query(
                `SELECT 
                    IdFacturasVentasCompras,
                    Upc,
                    Descripcion,
                    Cantidad,
                    Costo,
                    Precio
                FROM FacturasManualesFELDetalle
                WHERE IdFacturasVentasCompras IN (?)
                ORDER BY IdFacturasVentasCompras, Upc`,
                [ids]
            );
            
            // Asociar productos a cada factura
            datosFiltrados.forEach(factura => {
                factura.productos = productos.filter(p => p.IdFacturasVentasCompras === factura.IdFacturasVentasCompras);
            });
        }
        
        Swal.close();
        
        // Mostrar resultados
        if (results.length === 0) {
            mostrarSinResultados();
        } else {
            paginaActual = 1;
            mostrarResultados();
            document.getElementById('btnExportar').disabled = false;
        }
        
    } catch (error) {
        console.error('Error al buscar facturas:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error al buscar',
            text: error.message || 'No se pudieron cargar las facturas',
            confirmButtonColor: '#6e78ff'
        });
    }
}

// Conectar a la base de datos
async function conectarBaseDatos() {
    if (conexionGestion) {
        try {
            // Verificar si la conexión está activa
            await conexionGestion.query('SELECT 1');
            return; // Conexión activa
        } catch (error) {
            // Conexión perdida, reconectar
            conexionGestion = null;
        }
    }
    
    try {
        const config = {
            host: '172.30.1.17',
            user: 'compras',
            password: 'bode.24451988',
            database: 'Gestion'
        };
        
        conexionGestion = await mysql.createConnection(config);
    } catch (error) {
        throw new Error('No se pudo conectar a la base de datos');
    }
}

// ==================== MOSTRAR RESULTADOS ====================

function mostrarResultados() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';
    
    // Calcular registros de la página actual
    const inicio = (paginaActual - 1) * registrosPorPagina;
    const fin = inicio + registrosPorPagina;
    const registrosPagina = datosFiltrados.slice(inicio, fin);
    
    registrosPagina.forEach(factura => {
        const tipoBadge = factura.TipoFactura === 1 
            ? '<span class="badge-tipo venta">Venta</span>' 
            : '<span class="badge-tipo venta-compra">Venta-Compra</span>';
        
        const fechaRegistro = factura.FechaHoraRegistro 
            ? formatearFechaHora(factura.FechaHoraRegistro)
            : 'N/A';
        
        // Si la factura tiene productos, crear una fila por cada producto
        if (factura.productos && factura.productos.length > 0) {
            factura.productos.forEach((producto, indexProducto) => {
                const row = document.createElement('tr');
                
                row.innerHTML = `
                    <td>${factura.IdFacturasVentasCompras}</td>
                    <td>${formatearFecha(factura.FechaFactura)}</td>
                    <td><strong>${factura.Serie}-${factura.NoDocumento}</strong></td>
                    <td>${tipoBadge}</td>
                    <td><small>${factura.NombreSucursal}</small></td>
                    <td><strong>Q ${parseFloat(factura.Total).toFixed(2)}</strong></td>
                    <td><small>${factura.NombreUsuario}</small></td>
                    <td><small>${fechaRegistro}</small></td>
                    <td style="font-family: monospace; color: var(--text-secondary);">${producto.Upc}</td>
                    <td style="font-weight: 500;">${producto.Descripcion}</td>
                    <td style="text-align: right; color: var(--info-color); font-weight: 600;">${parseFloat(producto.Cantidad).toFixed(2)}</td>
                    <td style="text-align: right; color: var(--text-secondary);">Q ${parseFloat(producto.Costo).toFixed(2)}</td>
                    <td style="text-align: right; color: var(--success-color); font-weight: 700;">Q ${parseFloat(producto.Precio).toFixed(2)}</td>
                `;
                
                tbody.appendChild(row);
            });
        } else {
            // Si no tiene productos, mostrar una fila sin datos de productos
            const row = document.createElement('tr');
            row.style.opacity = '0.6';
            
            row.innerHTML = `
                <td>${factura.IdFacturasVentasCompras}</td>
                <td>${formatearFecha(factura.FechaFactura)}</td>
                <td><strong>${factura.Serie}-${factura.NoDocumento}</strong></td>
                <td>${tipoBadge}</td>
                <td><small>${factura.NombreSucursal}</small></td>
                <td><strong>Q ${parseFloat(factura.Total).toFixed(2)}</strong></td>
                <td><small>${factura.NombreUsuario}</small></td>
                <td><small>${fechaRegistro}</small></td>
                <td colspan="5" style="color: var(--text-tertiary); text-align: center; font-style: italic;">Sin productos</td>
            `;
            
            tbody.appendChild(row);
        }
    });
    
    // Actualizar contador (ahora contamos productos, no facturas)
    let totalProductos = 0;
    datosFiltrados.forEach(f => {
        totalProductos += f.productos ? f.productos.length : 0;
    });
    
    document.getElementById('registrosCount').textContent = 
        `${totalProductos} producto${totalProductos !== 1 ? 's' : ''} (${datosFiltrados.length} factura${datosFiltrados.length !== 1 ? 's' : ''})`;
    
    // Actualizar paginación
    actualizarPaginacion();
}

function mostrarSinResultados() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = `
        <tr class="empty-state">
            <td colspan="13">
                <i class="fas fa-inbox"></i>
                <p>No se encontraron facturas</p>
                <small>Intenta con otro rango de fechas o filtros diferentes</small>
            </td>
        </tr>
    `;
    
    document.getElementById('registrosCount').textContent = '0 registros';
    document.getElementById('paginationControls').style.display = 'none';
    document.getElementById('btnExportar').disabled = true;
}

// ==================== PAGINACIÓN ====================

function actualizarPaginacion() {
    const totalPaginas = Math.ceil(datosFiltrados.length / registrosPorPagina);
    
    if (totalPaginas <= 1) {
        document.getElementById('paginationControls').style.display = 'none';
        document.getElementById('paginationInfo').textContent = `Página 1 de 1`;
        return;
    }
    
    document.getElementById('paginationControls').style.display = 'flex';
    document.getElementById('paginationInfo').textContent = `Página ${paginaActual} de ${totalPaginas}`;
    
    // Habilitar/deshabilitar botones
    document.getElementById('btnPrimera').disabled = paginaActual === 1;
    document.getElementById('btnAnterior').disabled = paginaActual === 1;
    document.getElementById('btnSiguiente').disabled = paginaActual === totalPaginas;
    document.getElementById('btnUltima').disabled = paginaActual === totalPaginas;
    
    // Generar números de página
    const pageNumbers = document.getElementById('pageNumbers');
    pageNumbers.innerHTML = '';
    
    // Mostrar máximo 5 números de página
    let inicio = Math.max(1, paginaActual - 2);
    let fin = Math.min(totalPaginas, inicio + 4);
    
    if (fin - inicio < 4) {
        inicio = Math.max(1, fin - 4);
    }
    
    for (let i = inicio; i <= fin; i++) {
        const btn = document.createElement('button');
        btn.className = 'page-number' + (i === paginaActual ? ' active' : '');
        btn.textContent = i;
        btn.addEventListener('click', () => irAPagina(i));
        pageNumbers.appendChild(btn);
    }
}

function irAPagina(pagina) {
    const totalPaginas = Math.ceil(datosFiltrados.length / registrosPorPagina);
    
    if (pagina < 1 || pagina > totalPaginas) return;
    
    paginaActual = pagina;
    mostrarResultados();
    
    // Scroll al inicio de la tabla
    document.querySelector('.table-container').scrollTop = 0;
}

// ==================== DETALLE DE FACTURA ====================

async function verDetalle(idFactura) {
    try {
        // Buscar factura en los datos cargados
        const factura = datosFiltrados.find(f => f.IdFacturasVentasCompras === idFactura);
        
        if (!factura) {
            throw new Error('Factura no encontrada');
        }
        
        // Mostrar loading
        Swal.fire({
            title: 'Cargando detalle...',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
        
        // Conectar y obtener productos
        await conectarBaseDatos();
        
        const [productos] = await conexionGestion.query(
            `SELECT 
                Upc,
                Descripcion,
                Cantidad,
                Costo,
                Precio
            FROM FacturasManualesFELDetalle
            WHERE IdFacturasVentasCompras = ?
            ORDER BY Upc`,
            [idFactura]
        );
        
        Swal.close();
        
        // Mostrar modal
        mostrarModalDetalle(factura, productos);
        
    } catch (error) {
        console.error('Error al cargar detalle:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error al cargar detalle',
            text: error.message || 'No se pudo cargar el detalle de la factura',
            confirmButtonColor: '#6e78ff'
        });
    }
}

function mostrarModalDetalle(factura, productos) {
    const detalleInfo = document.getElementById('detalleInfo');
    
    const tipoBadge = factura.TipoFactura === 1 
        ? '<span class="badge-tipo venta">Solo Venta</span>' 
        : '<span class="badge-tipo venta-compra">Venta-Compra</span>';
    
    const sucursalCliente = factura.SucursalCliente === '0' || !factura.SucursalCliente 
        ? 'N/A' 
        : factura.SucursalCliente;
    
    const razonCliente = factura.RazonSocialCliente === '0' || !factura.RazonSocialCliente 
        ? 'N/A' 
        : factura.RazonSocialCliente;
    
    detalleInfo.innerHTML = `
        <div class="info-item">
            <span class="info-label">ID Factura</span>
            <span class="info-value">${factura.IdFacturasVentasCompras}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Fecha Factura</span>
            <span class="info-value">${formatearFecha(factura.FechaFactura)}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Serie - Número</span>
            <span class="info-value">${factura.Serie}-${factura.NoDocumento}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Tipo</span>
            <span class="info-value">${tipoBadge}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Sucursal que Vende</span>
            <span class="info-value">${factura.NombreSucursal}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Razón Social Vende</span>
            <span class="info-value">${factura.RazonSocial}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Sucursal que Compra</span>
            <span class="info-value">${sucursalCliente}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Razón Social Compra</span>
            <span class="info-value">${razonCliente}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Total</span>
            <span class="info-value" style="color: var(--success-color); font-size: 1.2rem; font-weight: 700;">Q ${parseFloat(factura.Total).toFixed(2)}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Usuario Registró</span>
            <span class="info-value">${factura.NombreUsuario}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Fecha Registro</span>
            <span class="info-value">${formatearFechaHora(factura.FechaHoraRegistro)}</span>
        </div>
    `;
    
    // Mostrar productos
    const tbody = document.getElementById('detalleProductosBody');
    tbody.innerHTML = '';
    
    productos.forEach(producto => {
        const subtotal = parseFloat(producto.Cantidad) * parseFloat(producto.Precio);
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${producto.Upc}</td>
            <td>${producto.Descripcion}</td>
            <td>${parseFloat(producto.Cantidad).toFixed(2)}</td>
            <td>Q ${parseFloat(producto.Costo).toFixed(2)}</td>
            <td>Q ${parseFloat(producto.Precio).toFixed(2)}</td>
            <td><strong>Q ${subtotal.toFixed(2)}</strong></td>
        `;
        tbody.appendChild(row);
    });
    
    // Mostrar modal
    document.getElementById('modalDetalle').style.display = 'flex';
}

function cerrarModal() {
    document.getElementById('modalDetalle').style.display = 'none';
}

// ==================== EXPORTAR A EXCEL ====================

async function exportarExcel() {
    if (datosFiltrados.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Sin datos',
            text: 'No hay datos para exportar',
            confirmButtonColor: '#6e78ff'
        });
        return;
    }
    
    try {
        // Preparar datos para Excel - Una fila por producto
        const datosExcel = [];
        
        datosFiltrados.forEach(factura => {
            const tipoFactura = factura.TipoFactura === 1 ? 'Venta' : 'Venta-Compra';
            const sucursalCompra = factura.SucursalCliente === '0' || !factura.SucursalCliente ? 'N/A' : factura.SucursalCliente;
            const razonCompra = factura.RazonSocialCliente === '0' || !factura.RazonSocialCliente ? 'N/A' : factura.RazonSocialCliente;
            
            // Si tiene productos, crear una fila por cada producto
            if (factura.productos && factura.productos.length > 0) {
                factura.productos.forEach(producto => {
                    datosExcel.push({
                        'IdFacturaVentasCompras': factura.IdFacturasVentasCompras,
                        'UPC': producto.Upc,
                        'Descripcion': producto.Descripcion,
                        'Cantidad': parseFloat(producto.Cantidad).toFixed(2),
                        'Costo': parseFloat(producto.Costo).toFixed(2),
                        'Precio': parseFloat(producto.Precio).toFixed(2),
                        'Nombre Sucursal Vende': factura.NombreSucursal,
                        'Razon Social Vende': factura.RazonSocial,
                        'Sucursal Compra': sucursalCompra,
                        'Razon Social Compra': razonCompra,
                        'Serie': factura.Serie,
                        'No. Documento': factura.NoDocumento,
                        'Total': parseFloat(factura.Total).toFixed(2),
                        'Tipo Factura': tipoFactura,
                        'Fecha Hora Registro': formatearFechaHora(factura.FechaHoraRegistro),
                        'Nombre Usuario': factura.NombreUsuario
                    });
                });
            } else {
                // Si no tiene productos, agregar una fila sin datos de producto
                datosExcel.push({
                    'IdFacturaVentasCompras': factura.IdFacturasVentasCompras,
                    'UPC': '',
                    'Descripcion': 'Sin productos',
                    'Cantidad': '',
                    'Costo': '',
                    'Precio': '',
                    'Nombre Sucursal Vende': factura.NombreSucursal,
                    'Razon Social Vende': factura.RazonSocial,
                    'Sucursal Compra': sucursalCompra,
                    'Razon Social Compra': razonCompra,
                    'Serie': factura.Serie,
                    'No. Documento': factura.NoDocumento,
                    'Total': parseFloat(factura.Total).toFixed(2),
                    'Tipo Factura': tipoFactura,
                    'Fecha Hora Registro': formatearFechaHora(factura.FechaHoraRegistro),
                    'Nombre Usuario': factura.NombreUsuario
                });
            }
        });
        
        // Crear libro de Excel
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(datosExcel);
        
        // Ajustar anchos de columna
        ws['!cols'] = [
            { wch: 10 }, // IdFacturaVentasCompras
            { wch: 15 }, // UPC
            { wch: 40 }, // Descripcion
            { wch: 10 }, // Cantidad
            { wch: 10 }, // Costo
            { wch: 10 }, // Precio
            { wch: 30 }, // Nombre Sucursal Vende
            { wch: 25 }, // Razon Social Vende
            { wch: 30 }, // Sucursal Compra
            { wch: 25 }, // Razon Social Compra
            { wch: 10 }, // Serie
            { wch: 15 }, // No. Documento
            { wch: 12 }, // Total
            { wch: 15 }, // Tipo Factura
            { wch: 20 }, // Fecha Hora Registro
            { wch: 25 }  // Nombre Usuario
        ];
        
        XLSX.utils.book_append_sheet(wb, ws, 'Facturas');
        
        // Generar nombre de archivo
        const fechaDesde = document.getElementById('fechaDesde').value;
        const fechaHasta = document.getElementById('fechaHasta').value;
        const nombreArchivo = `Facturas_${fechaDesde}_${fechaHasta}.xlsx`;
        
        // Obtener la ruta de la carpeta de Descargas
        const downloadsPath = path.join(os.homedir(), 'Downloads');
        const rutaCompleta = path.join(downloadsPath, nombreArchivo);
        
        // Generar el buffer del archivo
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
        
        // Guardar el archivo en Descargas
        fs.writeFileSync(rutaCompleta, wbout);
        
        Swal.fire({
            icon: 'success',
            title: '¡Exportado!',
            html: `
                <p>El archivo se ha guardado correctamente en Descargas.</p>
                <p style="font-size: 0.9rem; margin-top: 0.8rem;"><strong>Archivo:</strong> ${nombreArchivo}</p>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.5rem;">
                    <strong>Productos exportados:</strong> ${datosExcel.length}
                </p>
                <p style="font-size: 0.8rem; color: var(--text-tertiary); margin-top: 0.5rem;">
                    <strong>Ubicación:</strong> ${rutaCompleta}
                </p>
            `,
            confirmButtonColor: '#6e78ff',
            timer: 5000
        });
        
    } catch (error) {
        console.error('Error al exportar:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error al exportar',
            text: error.message || 'No se pudo generar el archivo Excel',
            confirmButtonColor: '#6e78ff'
        });
    }
}

// ==================== UTILIDADES ====================

function formatearFecha(fecha) {
    if (!fecha) return 'N/A';
    
    const date = new Date(fecha);
    const dia = String(date.getDate()).padStart(2, '0');
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const anio = date.getFullYear();
    
    return `${dia}/${mes}/${anio}`;
}

function formatearFechaHora(fechaHora) {
    if (!fechaHora) return 'N/A';
    
    const date = new Date(fechaHora);
    const dia = String(date.getDate()).padStart(2, '0');
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const anio = date.getFullYear();
    const horas = String(date.getHours()).padStart(2, '0');
    const minutos = String(date.getMinutes()).padStart(2, '0');
    
    return `${dia}/${mes}/${anio} ${horas}:${minutos}`;
}

// Cerrar conexión al salir
window.addEventListener('beforeunload', async () => {
    if (conexionGestion) {
        try {
            await conexionGestion.end();
        } catch (error) {
            console.error('Error al cerrar conexión:', error);
        }
    }
});