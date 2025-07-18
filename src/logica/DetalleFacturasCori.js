const Swal = require('sweetalert2');
const odbc = require('odbc');
const conexionfacturas = 'DSN=facturas';
const ExcelJS = require('exceljs');

// Variables globales
let datosFacturas = [];
let isLoading = false;

// Elementos del DOM
const fechaInicio = document.getElementById('fechaInicio');
const fechaFin = document.getElementById('fechaFin');
const btnBuscar = document.getElementById('btnBuscar');
const btnExportar = document.getElementById('btnExportar');
const btnLimpiar = document.getElementById('btnLimpiar');
const tablaFacturas = document.getElementById('tablaFacturas');
const tablaBody = document.getElementById('tablaBody');
const noData = document.getElementById('noData');
const loading = document.getElementById('loading');
const resultsInfo = document.getElementById('resultsInfo');
const totalRegistros = document.getElementById('totalRegistros');

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    inicializar();
    agregarEventListeners();
});

function inicializar() {
    // Establecer fecha por defecto (último mes)
    const hoy = new Date();
    const hace30Dias = new Date();
    hace30Dias.setDate(hoy.getDate() - 30);
    
    fechaInicio.value = hace30Dias.toISOString().split('T')[0];
    fechaFin.value = hoy.toISOString().split('T')[0];
    
    // Establecer límites de fecha
    fechaInicio.max = hoy.toISOString().split('T')[0];
    fechaFin.max = hoy.toISOString().split('T')[0];
    
    console.log('Aplicación inicializada correctamente');
}

function agregarEventListeners() {
    // Eventos de los botones
    btnBuscar.addEventListener('click', buscarFacturas);
    btnExportar.addEventListener('click', exportarExcel);
    btnLimpiar.addEventListener('click', limpiarFormulario);
    
    // Validación de fechas
    fechaInicio.addEventListener('change', validarFechas);
    fechaFin.addEventListener('change', validarFechas);
    
    // Enter en los campos de fecha
    fechaInicio.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') buscarFacturas();
    });
    
    fechaFin.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') buscarFacturas();
    });
}

function validarFechas() {
    const inicio = new Date(fechaInicio.value);
    const fin = new Date(fechaFin.value);
    
    if (fechaInicio.value && fechaFin.value) {
        if (inicio > fin) {
            Swal.fire({
                icon: 'warning',
                title: 'Fechas inválidas',
                text: 'La fecha de inicio no puede ser mayor que la fecha fin',
                confirmButtonColor: '#1e40af'
            });
            fechaInicio.focus();
            return false;
        }
        
        // Validar que no sea más de 1 año de diferencia
        const diferenciaDias = Math.ceil((fin - inicio) / (1000 * 60 * 60 * 24));
        if (diferenciaDias > 365) {
            Swal.fire({
                icon: 'warning',
                title: 'Rango muy amplio',
                text: 'El rango de fechas no puede ser mayor a 1 año',
                confirmButtonColor: '#1e40af'
            });
            return false;
        }
    }
    
    return true;
}

async function buscarFacturas() {
    try {
        // Validaciones
        if (!fechaInicio.value || !fechaFin.value) {
            Swal.fire({
                icon: 'warning',
                title: 'Campos requeridos',
                text: 'Por favor seleccione las fechas de inicio y fin',
                confirmButtonColor: '#1e40af'
            });
            return;
        }
        
        if (!validarFechas()) return;
        
        if (isLoading) return;
        
        mostrarLoading(true);
        
        // Query SQL
        const query = `
            SELECT
                factura_inventario.Id,
                factura_inventario.IdCaja, 
                factura_inventario.NombreUsuario, 
                factura_inventario.NombreEmpresa, 
                factura_inventario.NombreCliente, 
                factura_inventario.Serie, 
                factura_inventario.Numero, 
                factura_inventario.UID, 
                factura_inventario.TotalCosto, 
                factura_inventario.TotalPrecio, 
                factura_inventario.FechaCertificacion, 
                sucursal_genera.SucursalNombre AS SucursalGenera, 
                sucursal_cliente.SucursalNombre AS SucursalCliente, 
                sucursal_certifica.SucursalNombre AS SucursalCertifica, 
                Estado_Facturainventario.NombreEstado, 
                detalle_facturainventario.UPC, 
                detalle_facturainventario.Descripcion, 
                detalle_facturainventario.Cantidad, 
                detalle_facturainventario.Costo, 
                detalle_facturainventario.Precio, 
                detalle_facturainventario.SubTotalCosto, 
                detalle_facturainventario.SubTotalPrecio, 
                detalle_facturainventario.SubTotalPrecioSinIva, 
                detalle_facturainventario.SubTotalIva
            FROM
                factura_inventario
                INNER JOIN
                sucursal_facturas AS sucursal_genera
                ON 
                    factura_inventario.IdSucursalGenera = sucursal_genera.IdSucursal
                INNER JOIN
                sucursal_facturas AS sucursal_cliente
                ON 
                    factura_inventario.IdSucursalCliente = sucursal_cliente.IdSucursal
                INNER JOIN
                sucursal_facturas AS sucursal_certifica
                ON 
                    factura_inventario.IdSucursalCertifica = sucursal_certifica.IdSucursal
                INNER JOIN
                Estado_Facturainventario
                ON 
                    factura_inventario.Estado = Estado_Facturainventario.IdEstadoFI
                INNER JOIN
                detalle_facturainventario
                ON 
                    factura_inventario.Id = detalle_facturainventario.IdFactura
            WHERE
                factura_inventario.FechaCertificacion BETWEEN ? AND ?
            ORDER BY
                factura_inventario.FechaCertificacion DESC,
                factura_inventario.Id DESC
        `;
        
        // Ejecutar consulta con codificación UTF-8
        const connection = await odbc.connect(conexionfacturas);
        
        // Configurar codificación si es posible
        try {
            await connection.query("SET NAMES 'utf8'");
        } catch (e) {
            console.log('No se pudo configurar UTF-8, usando codificación por defecto');
        }
        
        const result = await connection.query(query, [fechaInicio.value, fechaFin.value]);
        await connection.close();
        
        datosFacturas = result;
        mostrarResultados();
        
    } catch (error) {
        console.error('Error al buscar facturas:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error de conexión',
            text: 'No se pudo conectar a la base de datos. Verifique la conexión.',
            confirmButtonColor: '#1e40af'
        });
    } finally {
        mostrarLoading(false);
    }
}

function mostrarResultados() {
    if (datosFacturas.length === 0) {
        // No hay datos
        tablaFacturas.style.display = 'none';
        noData.style.display = 'flex';
        noData.innerHTML = `
            <i class="fas fa-inbox"></i>
            <p>No se encontraron facturas en el rango de fechas seleccionado</p>
        `;
        resultsInfo.style.display = 'none';
        btnExportar.disabled = true;
        return;
    }
    
    // Mostrar tabla
    noData.style.display = 'none';
    tablaFacturas.style.display = 'table';
    resultsInfo.style.display = 'block';
    totalRegistros.textContent = datosFacturas.length.toLocaleString();
    btnExportar.disabled = false;
    
    // Limpiar tabla
    tablaBody.innerHTML = '';
    
    // Llenar tabla
    datosFacturas.forEach(factura => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${factura.Id || ''}</td>
            <td>${factura.IdCaja || ''}</td>
            <td>${formatearTextoSeguro(factura.NombreUsuario)}</td>
            <td>${formatearTextoSeguro(factura.NombreEmpresa)}</td>
            <td>${formatearTextoSeguro(factura.NombreCliente)}</td>
            <td>${formatearTextoSeguro(factura.Serie)}</td>
            <td>${factura.Numero || ''}</td>
            <td>${formatearTextoSeguro(factura.UID)}</td>
            <td>${formatearMoneda(factura.TotalCosto)}</td>
            <td>${formatearMoneda(factura.TotalPrecio)}</td>
            <td>${formatearFecha(factura.FechaCertificacion)}</td>
            <td>${formatearTextoSeguro(factura.SucursalGenera)}</td>
            <td>${formatearTextoSeguro(factura.SucursalCliente)}</td>
            <td>${formatearTextoSeguro(factura.SucursalCertifica)}</td>
            <td>${formatearTextoSeguro(factura.NombreEstado)}</td>
            <td>${formatearTextoSeguro(factura.UPC)}</td>
            <td>${formatearTextoSeguro(factura.Descripcion)}</td>
            <td>${formatearCantidad(factura.Cantidad)}</td>
            <td>${formatearMoneda(factura.Costo)}</td>
            <td>${formatearMoneda(factura.Precio)}</td>
            <td>${formatearMoneda(factura.SubTotalCosto)}</td>
            <td>${formatearMoneda(factura.SubTotalPrecio)}</td>
            <td>${formatearMoneda(factura.SubTotalPrecioSinIva)}</td>
            <td>${formatearMoneda(factura.SubTotalIva)}</td>
        `;
        tablaBody.appendChild(row);
    });
}

async function exportarExcel() {
    try {
        if (datosFacturas.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Sin datos',
                text: 'No hay datos para exportar',
                confirmButtonColor: '#1e40af'
            });
            return;
        }
        
        mostrarLoading(true);
        
        // Crear libro de Excel
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Facturas de Cori');
        
        // Configurar columnas
        worksheet.columns = [
            { header: 'ID', key: 'Id', width: 10 },
            { header: 'ID Caja', key: 'IdCaja', width: 12 },
            { header: 'Usuario', key: 'NombreUsuario', width: 20 },
            { header: 'Empresa', key: 'NombreEmpresa', width: 25 },
            { header: 'Cliente', key: 'NombreCliente', width: 25 },
            { header: 'Serie', key: 'Serie', width: 10 },
            { header: 'Número', key: 'Numero', width: 15 },
            { header: 'UID', key: 'UID', width: 20 },
            { header: 'Total Costo', key: 'TotalCosto', width: 15 },
            { header: 'Total Precio', key: 'TotalPrecio', width: 15 },
            { header: 'Fecha Certificación', key: 'FechaCertificacion', width: 20 },
            { header: 'Sucursal Genera', key: 'SucursalGenera', width: 20 },
            { header: 'Sucursal Cliente', key: 'SucursalCliente', width: 20 },
            { header: 'Sucursal Certifica', key: 'SucursalCertifica', width: 20 },
            { header: 'Estado', key: 'NombreEstado', width: 15 },
            { header: 'UPC', key: 'UPC', width: 15 },
            { header: 'Descripción', key: 'Descripcion', width: 30 },
            { header: 'Cantidad', key: 'Cantidad', width: 12 },
            { header: 'Costo', key: 'Costo', width: 12 },
            { header: 'Precio', key: 'Precio', width: 12 },
            { header: 'SubTotal Costo', key: 'SubTotalCosto', width: 15 },
            { header: 'SubTotal Precio', key: 'SubTotalPrecio', width: 15 },
            { header: 'SubTotal Precio Sin IVA', key: 'SubTotalPrecioSinIva', width: 20 },
            { header: 'SubTotal IVA', key: 'SubTotalIva', width: 15 }
        ];
        
        // Estilo del encabezado
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1E40AF' }
        };
        worksheet.getRow(1).font = { color: { argb: 'FFFFFF' }, bold: true };
        
        // Agregar datos con limpieza de texto
        datosFacturas.forEach(factura => {
            worksheet.addRow({
                Id: factura.Id,
                IdCaja: factura.IdCaja,
                NombreUsuario: formatearTextoSeguro(factura.NombreUsuario),
                NombreEmpresa: formatearTextoSeguro(factura.NombreEmpresa),
                NombreCliente: formatearTextoSeguro(factura.NombreCliente),
                Serie: formatearTextoSeguro(factura.Serie),
                Numero: factura.Numero,
                UID: formatearTextoSeguro(factura.UID),
                TotalCosto: factura.TotalCosto,
                TotalPrecio: factura.TotalPrecio,
                FechaCertificacion: factura.FechaCertificacion,
                SucursalGenera: formatearTextoSeguro(factura.SucursalGenera),
                SucursalCliente: formatearTextoSeguro(factura.SucursalCliente),
                SucursalCertifica: formatearTextoSeguro(factura.SucursalCertifica),
                NombreEstado: formatearTextoSeguro(factura.NombreEstado),
                UPC: formatearTextoSeguro(factura.UPC),
                Descripcion: formatearTextoSeguro(factura.Descripcion),
                Cantidad: factura.Cantidad,
                Costo: factura.Costo,
                Precio: factura.Precio,
                SubTotalCosto: factura.SubTotalCosto,
                SubTotalPrecio: factura.SubTotalPrecio,
                SubTotalPrecioSinIva: factura.SubTotalPrecioSinIva,
                SubTotalIva: factura.SubTotalIva
            });
        });
        
        // Aplicar formato a columnas numéricas
        const columnasMoneda = ['I', 'J', 'S', 'T', 'U', 'V', 'W', 'X']; // TotalCosto, TotalPrecio, etc.
        columnasMoneda.forEach(col => {
            worksheet.getColumn(col).numFmt = '#,##0.00';
        });
        
        // Formato para cantidad
        worksheet.getColumn('R').numFmt = '#,##0.00'; // Cantidad
        
        // Formato para fecha
        worksheet.getColumn('K').numFmt = 'dd/mm/yyyy'; // FechaCertificacion
        
        // Generar nombre del archivo
        const fechaActual = new Date().toISOString().split('T')[0];
        const nombreArchivo = `Facturas_Cori_${fechaInicio.value}_${fechaFin.value}_${fechaActual}.xlsx`;
        
        // Guardar archivo
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        // Crear enlace de descarga
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = nombreArchivo;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        Swal.fire({
            icon: 'success',
            title: 'Exportación exitosa',
            text: `Archivo "${nombreArchivo}" descargado correctamente`,
            confirmButtonColor: '#059669'
        });
        
    } catch (error) {
        console.error('Error al exportar Excel:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error al exportar',
            text: 'No se pudo generar el archivo Excel',
            confirmButtonColor: '#1e40af'
        });
    } finally {
        mostrarLoading(false);
    }
}

function limpiarFormulario() {
    // Limpiar campos
    fechaInicio.value = '';
    fechaFin.value = '';
    
    // Limpiar tabla
    tablaBody.innerHTML = '';
    tablaFacturas.style.display = 'none';
    resultsInfo.style.display = 'none';
    
    // Mostrar mensaje inicial
    noData.style.display = 'flex';
    noData.innerHTML = `
        <i class="fas fa-search"></i>
        <p>Seleccione un rango de fechas y haga clic en "Buscar" para ver los resultados</p>
    `;
    
    // Deshabilitar exportar
    btnExportar.disabled = true;
    
    // Limpiar datos
    datosFacturas = [];
    
    // Focus en fecha inicio
    fechaInicio.focus();
}

function mostrarLoading(mostrar) {
    isLoading = mostrar;
    loading.style.display = mostrar ? 'flex' : 'none';
    
    // Deshabilitar/habilitar botones
    btnBuscar.disabled = mostrar;
    btnExportar.disabled = mostrar || datosFacturas.length === 0;
    btnLimpiar.disabled = mostrar;
    fechaInicio.disabled = mostrar;
    fechaFin.disabled = mostrar;
}

function formatearMoneda(valor) {
    if (valor === null || valor === undefined || valor === '') return '';
    const numero = parseFloat(valor);
    if (isNaN(numero)) return '';
    return numero.toLocaleString('es-GT', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatearCantidad(valor) {
    if (valor === null || valor === undefined || valor === '') return '';
    const numero = parseFloat(valor);
    if (isNaN(numero)) return '';
    return numero.toLocaleString('es-GT', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Función para limpiar caracteres especiales y codificación
function limpiarTexto(texto) {
    if (!texto) return '';
    
    // Convertir a string si no lo es
    let textoLimpio = String(texto);
    
    // Reemplazar caracteres problemáticos comunes
    const reemplazos = {
        'Gener�': 'Generó',
        'Gener�': 'Generó', 
        'Certific�': 'Certificó',
        'Certific�': 'Certificó',
        'Anul�': 'Anuló',
        'Anul�': 'Anuló',
        'Modific�': 'Modificó',
        'Modific�': 'Modificó',
        'Cre�': 'Creó',
        'Cre�': 'Creó',
        '�': 'ó',
        '�': 'á',
        '�': 'é',
        '�': 'í',
        '�': 'ú',
        '�': 'ñ',
        '�': 'Á',
        '�': 'É',
        '�': 'Í',
        '�': 'Ó',
        '�': 'Ú',
        '�': 'Ñ',
        '�': 'ü',
        '�': 'Ü'
    };
    
    // Aplicar reemplazos
    Object.keys(reemplazos).forEach(caracter => {
        textoLimpio = textoLimpio.replace(new RegExp(caracter, 'g'), reemplazos[caracter]);
    });
    
    // Limpiar caracteres de control y espacios extra
    textoLimpio = textoLimpio.replace(/[\x00-\x1F\x7F]/g, '').trim();
    
    return textoLimpio;
}

// Función para formatear texto seguro
function formatearTextoSeguro(valor) {
    if (valor === null || valor === undefined) return '';
    return limpiarTexto(valor);
}

function formatearFecha(fecha) {
    if (!fecha) return '';
    try {
        const fechaObj = new Date(fecha);
        return fechaObj.toLocaleDateString('es-GT', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    } catch (error) {
        return fecha;
    }
}
window.addEventListener('error', function(event) {
    console.error('Error global:', event.error);
    if (isLoading) {
        mostrarLoading(false);
    }
});

// Prevenir cierre accidental durante carga
window.addEventListener('beforeunload', function(event) {
    if (isLoading) {
        event.preventDefault();
        event.returnValue = 'Hay una operación en curso. ¿Está seguro de que desea salir?';
        return event.returnValue;
    }
});

console.log('DetalleFacturasCori.js cargado correctamente');