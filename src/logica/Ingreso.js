const Swal = require('sweetalert2');
const odbc = require('odbc');
const conexionfacturas = 'DSN=facturas';
const conexionbodegona = 'DSN=ComprasBodegona';
const conexiongestion = 'DSN=Gestion';

document.addEventListener('DOMContentLoaded', function() {
    const upcInput = document.getElementById('upc');
    const upcError = document.getElementById('upcError');
    const form = document.getElementById('ingresoForm');
    const fechaInicio = document.getElementById('fechaInicio');
    const fechaFin = document.getElementById('fechaFin');
    const razonSocialSelect = document.getElementById('razonSocial');
    const descProductoSpan = document.getElementById('descProducto');
    const totalRegistrosSpan = document.getElementById('totalRegistros');
    const inventarioTable = document.getElementById('inventarioTable').getElementsByTagName('tbody')[0];
    
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

    function mostrarResultados(datos) {
        try {
            // Limpiar tabla existente
            inventarioTable.innerHTML = '';
            
            // Actualizar contador de registros
            totalRegistrosSpan.textContent = datos.length;

            if (datos.length === 0) {
                // Mostrar mensaje cuando no hay resultados
                const tr = document.createElement('tr');
                tr.innerHTML = '<td colspan="17" class="text-center">No se encontraron registros</td>';
                inventarioTable.appendChild(tr);
                return;
            }

            datos.forEach(row => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${row.IdInventario || ''}</td>
                    <td>${row.Upc || ''}</td>
                    <td>${row.Descripcion || ''}</td>
                    <td>${row.Cantidad || 0}</td>
                    <td>${row.Bonificiacion || 0}</td>
                    <td>${row.Costo}</td>
                    <td>${formatDate(row.FechaFactura)}</td>
                    <td>${formatDate(row.FechaRecepcion)}</td>
                    <td>${row.Proveedor || ''}</td>
                    <td>${row.Numero || ''}</td>
                    <td>${row.Serie || ''}</td>
                    <td>${row.RazonSocial || ''}</td>
                    <td>${row.Sucursal || ''}</td>
                    <td class="${row.EstadoOperacion === 'Activo' ? 'estado-activo' : 'estado-inactivo'}">
                        ${row.EstadoOperacion || ''}
                    </td>
                `;
                inventarioTable.appendChild(tr);
            });
        } catch (error) {
            console.error('Error en mostrarResultados:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error al mostrar resultados',
                text: error.message,
                confirmButtonText: 'Entendido'
            });
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

    // Manejo del formulario
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        try {
            // Mostrar indicador de carga
            Swal.fire({
                title: 'Procesando...',
                text: 'Por favor espere mientras se consultan los datos',
                allowOutsideClick: false,
                allowEscapeKey: false,
                allowEnterKey: false,
                showConfirmButton: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            const fechaInicioVal = fechaInicio.value;
            const fechaFinVal = fechaFin.value;
            const razonSocialVal = razonSocialSelect.value;
            const upcVal = upcInput.value ? upcInput.value.padStart(13, '0') : '';

            const datos = await consultarDatos(
                fechaInicioVal,
                fechaFinVal,
                razonSocialVal,
                upcVal
            );

            // Cerrar indicador de carga
            Swal.close();

            mostrarResultados(datos);

            if (datos.length === 0) {
                Swal.fire({
                    icon: 'info',
                    title: 'Sin resultados',
                    text: 'No se encontraron registros con los criterios especificados',
                    confirmButtonText: 'Entendido'
                });
            }

        } catch (error) {
            console.error('Error en submit:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error en la consulta',
                text: error.message,
                confirmButtonText: 'Entendido'
            });
        }
    });
    function formatDate(date) {
        if (!date) return '';
        const d = new Date(date);
        return d.toLocaleDateString('es-GT');
    }
});