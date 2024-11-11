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
            const loadingSwal = Swal.fire({
                title: 'Consultando datos',
                html: 'Obteniendo registros de la base de datos...',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });
    
            const fechaInicio = document.getElementById('fechaInicio').value;
            const fechaFin = document.getElementById('fechaFin').value;
            const razonSocial = document.getElementById('razonSocial').value;
            const upc = document.getElementById('upc').value;
    
            const datos = await consultarDatos(fechaInicio, fechaFin, razonSocial, upc);
            
            await loadingSwal.close();
    
            if (datos.length === 0) {
                await Swal.fire({
                    icon: 'info',
                    title: 'Sin resultados',
                    text: 'No se encontraron datos para exportar',
                    confirmButtonText: 'Entendido'
                });
                return;
            }
    
            // Confirmar formato de exportación
            const { value: formatoExport } = await Swal.fire({
                title: 'Seleccionar formato',
                text: 'Elige el formato de exportación:',
                input: 'radio',
                inputOptions: {
                    'csv': 'CSV (Recomendado para grandes volúmenes)',
                    'excel': 'Excel (Puede ser más lento)'
                },
                inputValue: 'csv',
                confirmButtonText: 'Exportar',
                showCancelButton: true,
                cancelButtonText: 'Cancelar'
            });
    
            if (formatoExport) {
                if (formatoExport === 'csv') {
                    await exportarCSV(datos, fechaInicio, fechaFin);
                } else {
                    await exportarExcel(datos, fechaInicio, fechaFin);
                }
            }
    
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
        // Configuración inicial de progreso
        const progressSwal = Swal.fire({
            title: 'Preparando exportación',
            html: `
                <div class="progress-info">
                    Iniciando proceso de exportación...
                    <br>
                    <progress value="0" max="100" style="width: 100%; margin-top: 10px;"></progress>
                </div>
            `,
            allowOutsideClick: false,
            showConfirmButton: false
        });
    
        try {
            // Crear un nuevo libro de trabajo con opciones de optimización
            const workbook = new ExcelJS.Workbook();
            workbook.properties.date1904 = true; // Optimización para fechas
            
            const worksheet = workbook.addWorksheet('Reporte de Ingresos', {
                properties: { 
                    tabColor: { argb: 'FF00FF00' },
                    defaultRowHeight: 15 // Altura fija para optimizar memoria
                },
                views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
            });
    
            // Definir columnas con tipos de datos específicos para optimizar memoria
            worksheet.columns = [
                { header: 'ID Inventario', key: 'IdInventario', width: 15, style: { numFmt: '0' } },
                { header: 'UPC', key: 'Upc', width: 15, style: { numFmt: '@' } },
                { header: 'Descripción', key: 'Descripcion', width: 40, style: { numFmt: '@' } },
                { header: 'Cantidad', key: 'Cantidad', width: 12, style: { numFmt: '0' } },
                { header: 'Bonificación', key: 'Bonificiacion', width: 12, style: { numFmt: '0' } },
                { header: 'Costo', key: 'Costo', width: 12, style: { numFmt: '"Q"#,##0.00' } },
                { header: 'Fecha Factura', key: 'FechaFactura', width: 15 },
                { header: 'Fecha Recepción', key: 'FechaRecepcion', width: 15 },
                { header: 'Proveedor', key: 'Proveedor', width: 30, style: { numFmt: '@' } },
                { header: 'Número', key: 'Numero', width: 12, style: { numFmt: '@' } },
                { header: 'Serie', key: 'Serie', width: 10, style: { numFmt: '@' } },
                { header: 'Razón Social', key: 'RazonSocial', width: 30, style: { numFmt: '@' } },
                { header: 'Sucursal', key: 'Sucursal', width: 20, style: { numFmt: '@' } },
                { header: 'Estado Operación', key: 'EstadoOperacion', width: 15, style: { numFmt: '@' } }
            ];
    
            // Aplicar estilo a los encabezados
            const headerRow = worksheet.getRow(1);
            headerRow.font = { bold: true };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };
    
            // Procesar datos en lotes más pequeños para optimizar memoria
            const BATCH_SIZE = 500; // Reducido para mejor manejo de memoria
            const totalBatches = Math.ceil(datos.length / BATCH_SIZE);
            let processedRows = 0;
    
            // Función para procesar un lote de datos
            const processBatch = async (startIndex) => {
                const endIndex = Math.min(startIndex + BATCH_SIZE, datos.length);
                const batch = datos.slice(startIndex, endIndex);
    
                const rows = batch.map(row => ({
                    ...row,
                    FechaFactura: row.FechaFactura ? new Date(row.FechaFactura) : null,
                    FechaRecepcion: row.FechaRecepcion ? new Date(row.FechaRecepcion) : null,
                    Costo: row.Costo ? Number(row.Costo) : 0
                }));
    
                // Agregar filas en bloque
                await worksheet.addRows(rows);
                processedRows += rows.length;
    
                // Actualizar progreso
                const progress = Math.round((processedRows / datos.length) * 100);
                Swal.update({
                    html: `
                        <div class="progress-info">
                            Procesando registros: ${processedRows.toLocaleString()} de ${datos.length.toLocaleString()}
                            <br>
                            Progreso: ${progress}%
                            <br>
                            <progress value="${progress}" max="100" style="width: 100%; margin-top: 10px;"></progress>
                        </div>
                    `
                });
    
                // Liberar memoria
                rows.length = 0;
                
                // Pequeña pausa para permitir que el GC actúe y la UI se actualice
                await new Promise(resolve => setTimeout(resolve, 10));
            };
    
            // Procesar todos los lotes
            for (let i = 0; i < datos.length; i += BATCH_SIZE) {
                await processBatch(i);
            }
    
            // Aplicar autofilter después de procesar todos los datos
            worksheet.autoFilter = {
                from: { row: 1, column: 1 },
                to: { row: 1, column: worksheet.columns.length }
            };
    
            // Generar el nombre del archivo
            const fechaGeneracion = new Date().toISOString().split('T')[0];
            const fileName = `Reporte_Ingresos_${fechaInicio}_${fechaFin}_${fechaGeneracion}.xlsx`;
    
            // Actualizar mensaje antes de generar el archivo
            Swal.update({
                html: `
                    <div class="progress-info">
                        Generando archivo Excel...
                        <br>
                        <progress value="100" max="100" style="width: 100%; margin-top: 10px;"></progress>
                    </div>
                `
            });
    
            // Generar y descargar el archivo
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { 
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
            });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.click();
            window.URL.revokeObjectURL(url);
    
            // Liberar memoria
            workbook.removeWorksheet(worksheet.id);
            buffer.length = 0;
    
        } catch (error) {
            console.error('Error en la exportación:', error);
            throw error;
        } finally {
            // Cerrar el diálogo de progreso
            await progressSwal.close();
        }
    }
    
    async function exportarCSV(datos, fechaInicio, fechaFin) {
        // Mostrar indicador de progreso
        const progressSwal = Swal.fire({
            title: 'Preparando exportación',
            html: `
                <div class="progress-info">
                    Iniciando proceso de exportación...
                    <br>
                    <progress value="0" max="100" style="width: 100%; margin-top: 10px;"></progress>
                </div>
            `,
            allowOutsideClick: false,
            showConfirmButton: false
        });
    
        try {
            // Definir encabezados
            const headers = [
                'ID Inventario',
                'UPC',
                'Descripción',
                'Cantidad',
                'Bonificación',
                'Costo',
                'Fecha Factura',
                'Fecha Recepción',
                'Proveedor',
                'Número',
                'Serie',
                'Razón Social',
                'Sucursal',
                'Estado Operación'
            ];
    
            // Función para escapar campos CSV
            const escaparCSV = (valor) => {
                if (valor === null || valor === undefined) return '';
                const str = valor.toString();
                if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                    return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
            };
    
            // Función para formatear fechas
            const formatearFecha = (fecha) => {
                if (!fecha) return '';
                const d = new Date(fecha);
                if (isNaN(d.getTime())) return '';
                return d.toLocaleDateString();
            };
    
            // Función para formatear números
            const formatearNumero = (numero) => {
                if (numero === null || numero === undefined) return '';
                return typeof numero === 'number' ? numero.toFixed(2) : numero;
            };
    
            // Iniciar con los encabezados
            let csvContent = headers.map(escaparCSV).join(',') + '\n';
    
            // Procesar datos en lotes
            const BATCH_SIZE = 1000;
            let processedRows = 0;
    
            for (let i = 0; i < datos.length; i += BATCH_SIZE) {
                const batch = datos.slice(i, Math.min(i + BATCH_SIZE, datos.length));
                
                // Procesar cada fila del lote
                const batchRows = batch.map(row => {
                    return [
                        row.IdInventario,
                        row.Upc,
                        row.Descripcion,
                        row.Cantidad,
                        row.Bonificiacion,
                        formatearNumero(row.Costo),
                        formatearFecha(row.FechaFactura),
                        formatearFecha(row.FechaRecepcion),
                        row.Proveedor,
                        row.Numero,
                        row.Serie,
                        row.RazonSocial,
                        row.Sucursal,
                        row.EstadoOperacion
                    ].map(escaparCSV).join(',');
                }).join('\n');
    
                csvContent += batchRows + '\n';
                processedRows += batch.length;
    
                // Actualizar progreso
                const progress = Math.round((processedRows / datos.length) * 100);
                Swal.update({
                    html: `
                        <div class="progress-info">
                            Procesando registros: ${processedRows.toLocaleString()} de ${datos.length.toLocaleString()}
                            <br>
                            Progreso: ${progress}%
                            <br>
                            <progress value="${progress}" max="100" style="width: 100%; margin-top: 10px;"></progress>
                        </div>
                    `
                });
    
                // Pequeña pausa para la UI
                await new Promise(resolve => setTimeout(resolve, 0));
            }
    
            // Agregar BOM para correcto manejo de caracteres especiales en Excel
            const BOM = '\uFEFF';
            const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' });
    
            // Generar nombre del archivo
            const fechaGeneracion = new Date().toISOString().split('T')[0];
            const fileName = `Reporte_Ingresos_${fechaInicio}_${fechaFin}_${fechaGeneracion}.csv`;
    
            // Descargar archivo
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.click();
            window.URL.revokeObjectURL(url);
    
            // Limpiar memoria
            csvContent = '';
    
            await progressSwal.close();
    
            // Mostrar mensaje de éxito
            await Swal.fire({
                icon: 'success',
                title: 'Exportación completada',
                text: 'El archivo CSV ha sido generado exitosamente',
                confirmButtonText: 'Entendido'
            });
    
        } catch (error) {
            console.error('Error en la exportación:', error);
            await progressSwal.close();
            throw error;
        }
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