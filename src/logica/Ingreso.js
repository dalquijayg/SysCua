const Swal = require('sweetalert2');
const odbc = require('odbc');
const conexionfacturas = 'DSN=facturas';
const conexionbodegona = 'DSN=ComprasBodegona';
const conexiongestion = 'DSN=Gestion';
const ExcelJS = require('exceljs');

document.addEventListener('DOMContentLoaded', function() {
    const upcInput = document.getElementById('upc');
    const upcError = document.getElementById('upcError');
    const form = document.getElementById('ingresoForm');
    const fechaInicio = document.getElementById('fechaInicio');
    const fechaFin = document.getElementById('fechaFin');
    const razonSocialSelect = document.getElementById('razonSocial');
    const descProductoSpan = document.getElementById('descProducto');

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        try {
            // Mostrar indicador de carga
            Swal.fire({
                title: 'Procesando datos',
                html: 'Esto puede tomar varios minutos...',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            const fechaInicio = document.getElementById('fechaInicio').value;
            const fechaFin = document.getElementById('fechaFin').value;
            const razonSocial = document.getElementById('razonSocial').value;
            const upc = document.getElementById('upc').value;

            // Obtener los datos
            const datos = await consultarDatos(fechaInicio, fechaFin, razonSocial, upc);
            
            if (datos.length === 0) {
                Swal.fire({
                    icon: 'info',
                    title: 'Sin resultados',
                    text: 'No se encontraron datos para exportar',
                    confirmButtonText: 'Entendido'
                });
                return;
            }

            await exportarExcel(datos, fechaInicio, fechaFin);
            
            Swal.fire({
                icon: 'success',
                title: 'Exportación completada',
                text: 'El archivo ha sido generado exitosamente',
                confirmButtonText: 'Entendido'
            });

        } catch (error) {
            console.error('Error en la exportación:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error en la exportación',
                text: `Ocurrió un error: ${error.message}`,
                confirmButtonText: 'Entendido'
            });
        }
    });
    
    async function exportarExcel(datos, fechaInicio, fechaFin) {
        // Crear un nuevo libro de trabajo
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Reporte de Ingresos');
    
        // Definir las columnas
        worksheet.columns = [
            { header: 'ID Inventario', key: 'IdInventario', width: 15 },
            { header: 'UPC', key: 'Upc', width: 15 },
            { header: 'Descripción', key: 'Descripcion', width: 40 },
            { header: 'Cantidad', key: 'Cantidad', width: 12 },
            { header: 'Bonificación', key: 'Bonificiacion', width: 12 },
            { header: 'Costo', key: 'Costo', width: 12 },
            { header: 'Fecha Factura', key: 'FechaFactura', width: 15 },
            { header: 'Fecha Recepción', key: 'FechaRecepcion', width: 15 },
            { header: 'Proveedor', key: 'Proveedor', width: 30 },
            { header: 'Número', key: 'Numero', width: 12 },
            { header: 'Serie', key: 'Serie', width: 10 },
            { header: 'Razón Social', key: 'RazonSocial', width: 30 },
            { header: 'Sucursal', key: 'Sucursal', width: 20 },
            { header: 'Estado Operación', key: 'EstadoOperacion', width: 15 }
        ];
    
        // Estilo para los encabezados
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };
    
        // Procesar los datos en lotes para manejar grandes cantidades
        const BATCH_SIZE = 1000;
        for (let i = 0; i < datos.length; i += BATCH_SIZE) {
            const batch = datos.slice(i, i + BATCH_SIZE);
            
            batch.forEach(row => {
                // Formatear fechas antes de agregar la fila
                if (row.FechaFactura) {
                    row.FechaFactura = new Date(row.FechaFactura).toLocaleDateString();
                }
                if (row.FechaRecepcion) {
                    row.FechaRecepcion = new Date(row.FechaRecepcion).toLocaleDateString();
                }
                
                // Formatear números
                if (row.Costo) {
                    row.Costo = Number(row.Costo).toFixed(2);
                }
                
                worksheet.addRow(row);
            });
        }
    
        // Aplicar bordes a todas las celdas con datos
        worksheet.eachRow((row, rowNumber) => {
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        });
    
        // Agregar filtros a los encabezados
        worksheet.autoFilter = {
            from: { row: 1, column: 1 },
            to: { row: 1, column: worksheet.columns.length }
        };
    
        // Congelar la primera fila
        worksheet.views = [
            { state: 'frozen', xSplit: 0, ySplit: 1 }
        ];
    
        // Generar el nombre del archivo
        const fechaGeneracion = new Date().toISOString().split('T')[0];
        const fileName = `Reporte_Ingresos_${fechaInicio}_${fechaFin}_${fechaGeneracion}.xlsx`;
    
        // Guardar el archivo
        await workbook.xlsx.writeBuffer().then(buffer => {
            const blob = new Blob([buffer], { 
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
            });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.click();
            window.URL.revokeObjectURL(url);
        });
    }
    
    async function consultarDatos(fechaInicio, fechaFin, razonSocial, upc) {
        let connection;
        try {
            // Validar que las fechas no estén vacías
            if (!fechaInicio || !fechaFin) {
                throw new Error('Las fechas son requeridas');
            }

            connection = await odbc.connect(conexiongestion);
            
            // Convertir fechas a formato ISO para la consulta
            const fechaInicioISO = new Date(fechaInicio).toISOString().split('T')[0];
            const fechaFinISO = new Date(fechaFin).toISOString().split('T')[0];
            
            let query = `
                SELECT
                    reporteingresos.IdInventario, 
                    reporteingresos.Upc, 
                    reporteingresos.Descripcion, 
                    reporteingresos.Cantidad, 
                    reporteingresos.Bonificiacion, 
                    reporteingresos.Costo, 
                    reporteingresos.FechaFactura, 
                    reporteingresos.FechaRecepcion, 
                    reporteingresos.Proveedor, 
                    reporteingresos.Numero, 
                    reporteingresos.Serie, 
                    reporteingresos.RazonSocial, 
                    reporteingresos.Sucursal, 
                    reporteingresos.EstadoOperacion
                FROM
                    reporteingresos
                WHERE
                    CAST(reporteingresos.FechaFactura AS DATE) BETWEEN ? AND ?
            `;

            const params = [fechaInicioISO, fechaFinISO];

            if (razonSocial && razonSocial !== '') {
                query += ' AND reporteingresos.IdRazonSocial = ?';
                params.push(razonSocial);
            }

            if (upc && upc !== '') {
                query += ' AND reporteingresos.Upc = ?';
                params.push(upc);
            }

            query += ' ORDER BY reporteingresos.FechaFactura DESC';

            console.log('Ejecutando consulta:', query);
            console.log('Parámetros:', params);

            const result = await connection.query(query, params);
            
            if (!result || result.length === 0) {
                console.log('No se encontraron resultados');
                return [];
            }
            
            console.log(`Se encontraron ${result.length} registros`);
            return result;

        } catch (error) {
            console.error('Error en consultarDatos:', error);
            throw error;
        } finally {
            if (connection) {
                await connection.close();
            }
        }
    }
    
    upcInput.parentNode.insertBefore(descProductoSpan, upcInput.nextSibling);
    descProductoSpan.className = 'descripcion-producto';

    function padWithZeros(number, length) {
        return String(number).padStart(length, '0');
    }

    async function buscarProducto(upc) {
        let connection;
        try {
            connection = await odbc.connect(conexionbodegona);
            const query = `
                SELECT
                    productos.DescLarga
                FROM
                    productos
                WHERE
                    productos.Upc = ?
            `;
            
            const result = await connection.query(query, [upc]);
            
            if (result && result.length > 0) {
                descProductoSpan.textContent = result[0].DescLarga;
                descProductoSpan.style.color = '#4a5568'; // Color de texto normal
            } else {
                descProductoSpan.textContent = 'Producto no encontrado';
                descProductoSpan.style.color = '#e53e3e'; // Color rojo para error
                Swal.fire({
                    icon: 'warning',
                    title: 'Producto no encontrado',
                    text: 'No se encontró ningún producto con ese UPC',
                    confirmButtonText: 'Entendido'
                });
            }

        } catch (error) {
            console.error('Error al buscar producto:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error en la búsqueda',
                text: `Error al buscar el producto: ${error.message}`,
                confirmButtonText: 'Entendido'
            });
        } finally {
            if (connection) {
                await connection.close();
            }
        }
    }

    upcInput.addEventListener('keydown', async function(e) {
        if (e.key === 'Enter') {
            e.preventDefault(); // Prevenir el envío del formulario
            
            let value = this.value.trim();
            
            // Validar que solo contenga números
            if (!/^\d+$/.test(value)) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error en UPC',
                    text: 'El UPC solo debe contener números',
                    confirmButtonText: 'Entendido'
                });
                return;
            }

            // Completar con ceros a la izquierda si es necesario
            value = padWithZeros(value, 13);
            this.value = value; // Actualizar el valor en el input

            // Buscar el producto
            await buscarProducto(value);
        }
    });

    async function cargarRazonesSociales() {
        let connection;
        try {
            connection = await odbc.connect(conexionfacturas);
            const query = `
                SELECT
                    razonessociales.Id, 
                    razonessociales.NombreRazon
                FROM
                    razonessociales
                WHERE
                    razonessociales.Estado = 'V'
            `;
            
            const result = await connection.query(query);
            
            // Limpiar opciones existentes excepto la primera (placeholder)
            while (razonSocialSelect.options.length > 1) {
                razonSocialSelect.remove(1);
            }

            // Agregar las nuevas opciones
            result.forEach(razon => {
                const option = document.createElement('option');
                option.value = razon.Id;
                option.textContent = razon.NombreRazon;
                razonSocialSelect.appendChild(option);
            });

        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error al cargar razones sociales',
                text: `Hubo un problema al consultar la base de datos: ${error.message}`,
                confirmButtonText: 'Entendido'
            });
        } finally {
            if (connection) {
                await connection.close();
            }
        }
    }
    cargarRazonesSociales();

    // Validación del UPC (solo números)
    upcInput.addEventListener('input', function(e) {
        const value = e.target.value;
        if (!/^\d*$/.test(value)) {
            upcInput.classList.add('invalid');
            upcError.style.display = 'block';
            e.target.value = value.replace(/\D/g, '');
        } else {
            upcInput.classList.remove('invalid');
            upcError.style.display = 'none';
        }
        if (value.length > 13) {
            e.target.value = value.slice(0, 13);
        }
    });

    // Validación de fechas
    fechaFin.addEventListener('change', function() {
        if (fechaInicio.value && fechaFin.value) {
            if (new Date(fechaFin.value) < new Date(fechaInicio.value)) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error en fechas',
                    text: 'La fecha de fin no puede ser menor que la fecha de inicio',
                    confirmButtonText: 'Entendido'
                });
                fechaFin.value = '';
            }
        }
    });
});