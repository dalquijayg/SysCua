
const xlsx = require('xlsx');
const odbc = require('odbc');
const Swal = require('sweetalert2');
const conexionfacturas = 'DSN=facturas';

async function conectar() {
    try {
        const connection = await odbc.connect(conexionfacturas);
        await connection.query('SET NAMES utf8mb4');
        return connection;
    } catch (error) {
        console.error('Error al conectar a la base de datos:', error);
        throw error;
    }
}
async function populateDepartmentMultiSelect(connection, query) {
    try {
        const result = await connection.query(query);
        const selectContainer = document.querySelector('#department-select .select-items');
        
        if (!selectContainer) {
            console.error('No se encontró el contenedor de elementos seleccionables');
            return;
        }
        
        result.forEach(row => {
            const div = document.createElement('div');
            div.className = 'checkbox-container';
            div.innerHTML = `
                <input type="checkbox" id="dept-${row.Id}" value="${row.Id}">
                <label for="dept-${row.Id}">${row.Nombre}</label>
            `;
            selectContainer.appendChild(div);
        });

        // Manejar la apertura/cierre del dropdown
        const select = document.querySelector('#department-select');
        const selected = select ? select.querySelector('.select-selected') : null;
        
        if (selected) {
            selected.addEventListener('click', function(e) {
                e.stopPropagation();
                const selectItems = this.nextElementSibling;
                if (selectItems) {
                    selectItems.classList.toggle('select-hide');
                    this.classList.toggle('select-arrow-active');
                } else {
                    console.error('No se encontró el elemento de elementos seleccionables');
                }
            });
        } else {
            console.error('No se encontró el elemento seleccionado');
        }

        // Cerrar todos los select boxes cuando se hace clic fuera
        document.addEventListener('click', closeAllSelect);

        // Actualizar el texto seleccionado
        const checkboxes = selectContainer.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', updateSelectedText);
        });
    } catch (error) {
        console.error('Error al poblar el multiselect de departamentos:', error);
        throw error;
    }
}

function closeAllSelect(elmnt) {
    const selectItems = document.getElementsByClassName('select-items');
    const selectSelected = document.getElementsByClassName('select-selected');
    for (let i = 0; i < selectSelected.length; i++) {
        if (elmnt != selectSelected[i]) {
            selectSelected[i].classList.remove('select-arrow-active');
        }
    }
    for (let i = 0; i < selectItems.length; i++) {
        if (elmnt != selectItems[i]) {
            selectItems[i].classList.add('select-hide');
        }
    }
}

function updateSelectedText() {
    const checkboxes = document.querySelectorAll('#department-select input[type="checkbox"]');
    const selectedText = document.querySelector('#department-select .select-selected');
    if (!selectedText) {
        console.error('No se encontró el elemento de texto seleccionado');
        return;
    }
    const selectedDepts = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.nextElementSibling.textContent);
    
    selectedText.textContent = selectedDepts.length > 0 ? selectedDepts.join(', ') : 'Seleccionar Departamento';
}

// Función para ejecutar una consulta y llenar un combobox
async function populateCombobox(connection, query, comboboxId) {
    try {
        const result = await connection.query(query);
        const combobox = document.getElementById(comboboxId);
        
        // Limpiar opciones existentes
        combobox.innerHTML = '<option value="">Seleccionar</option>';
        
        // Añadir nuevas opciones
        result.forEach(row => {
            const option = document.createElement('option');
            option.value = row.Id;
            option.textContent = row.Nombre || row.NombreCompleto;
            combobox.appendChild(option);
        });
    } catch (error) {
        console.error(`Error al poblar el combobox ${comboboxId}:`, error);
        throw error;
    }
}

// Función principal para poblar todos los comboboxes
async function populateAllComboboxes() {
    let connection;
    try {
        connection = await conectar();
        
        await populateCombobox(
            connection,
            'SELECT proveedores_facturas.Id, proveedores_facturas.Nombre FROM proveedores_facturas',
            'provider'
        );
        
        await populateDepartmentMultiSelect(
            connection,
            'SELECT Costosdep.Id, Costosdep.Nombre FROM Costosdep WHERE Costosdep.Activo = 1'
        ); 
        
        await populateCombobox(
            connection,
            `SELECT usuarios.Id, CONCAT(usuarios.Nombres, ' ', usuarios.Apellidos) AS NombreCompleto 
             FROM usuarios 
             WHERE usuarios.Activo = 1 
               AND usuarios.IdNivel IN (11, 30)`,
            'user'
        );
        
        Swal.fire({
            icon: 'success',
            title: 'Éxito',
            text: 'Todos los comboboxes han sido poblados exitosamente',
            timer: 2000,
            showConfirmButton: false
        });
    } catch (error) {
        console.error('Error al poblar los comboboxes:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Ha ocurrido un error al cargar los datos',
            footer: `<details>
                        <summary>Detalles del error (para soporte técnico)</summary>
                        <p>${error.message}</p>
                        <p>Stack: ${error.stack}</p>
                    </details>`,
            confirmButtonText: 'Entendido'
        });
    } finally {
        if (connection) {
            try {
                await connection.close();
                console.log('Conexión a la base de datos cerrada');
            } catch (closeError) {
                console.error('Error al cerrar la conexión:', closeError);
            }
        }
    }
}

// Ejecutar la función cuando el DOM esté completamente cargado
document.addEventListener('DOMContentLoaded', populateAllComboboxes);

// Función para mostrar errores de forma genérica
function showError(title, text, error) {
    Swal.fire({
        icon: 'error',
        title: title,
        text: text,
        footer: `<details>
                    <summary>Detalles del error (para soporte técnico)</summary>
                    <p>${error.message}</p>
                    <p>Stack: ${error.stack}</p>
                </details>`,
        confirmButtonText: 'Entendido'
    });
}
function formatofecha(dateString) {
    // Parseamos la fecha asumiendo que está en UTC
    const date = new Date(dateString + 'T00:00:00Z');
    
    // Ajustamos la fecha a la zona horaria local
    const localDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
    
    // Formateamos la fecha
    return localDate.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}
async function performSearch() {
    Swal.fire({
        title: 'Cargando Historial de cuadre',
        text: 'Por favor espere...',
        allowOutsideClick: false,
        allowEscapeKey: false,
        allowEnterKey: false,
        showConfirmButton: false,
        willOpen: () => {
            Swal.showLoading();
        }
    });
    let connection;
    try {
        connection = await conectar();

        const proveedor = document.getElementById('provider').value;
        const departamentos = Array.from(document.querySelectorAll('#department-select input[type="checkbox"]:checked')).map(cb => cb.value);
        const usuario = document.getElementById('user').value;
        const fechaInicio = document.getElementById('start-date').value;
        const fechaFin = document.getElementById('end-date').value;
        const idInventario = document.getElementById('id-inventory').value;
        const numeroFactura = document.getElementById('invoice-number').value;
        const serie = document.getElementById('serie').value;
        const upc = document.getElementById('upc').value;

        let query = `
            SELECT
                cuadrecostos.Idcuadre, 
                cuadrecostos.Upc, 
                cuadrecostos.Descripcion, 
                proveedores_facturas.Nombre AS Proveedor, 
                cuadrecostos.FechaFactura, 
                cuadrecostos.NoFactura, 
                cuadrecostos.Serie, 
                cuadrecostos.costosistema, 
                cuadrecostos.costofacturado, 
                cuadrecostos.diferencia, 
                cuadrecostos.sucursal, 
                cuadrecostos.fechacuadre, 
                Costosdep.Nombre AS Departamento, 
                cuadrecostos.Costofiscal, 
                cuadrecostos.Iva, 
                cuadrecostos.CantidadIngresada, 
                razonessociales.NombreRazon, 
                cuadrecostos.BonificacionIngresada, 
                cuadrecostos.Usuario
            FROM
                cuadrecostos
                LEFT JOIN proveedores_facturas ON cuadrecostos.Proveedor = proveedores_facturas.Id
                LEFT JOIN Costosdep ON cuadrecostos.Departamento = Costosdep.Id
                LEFT JOIN razonessociales ON cuadrecostos.IdRazonSocial = razonessociales.Id
                LEFT JOIN usuarios ON cuadrecostos.IdUsuario = usuarios.Id
            WHERE 1=1
        `;

        const params = [];

        if (proveedor) {
            query += ' AND cuadrecostos.Proveedor = ?';
            params.push(proveedor);
        }

        if (departamentos.length > 0) {
            query += ` AND cuadrecostos.Departamento IN (${departamentos.map(() => '?').join(',')})`;
            params.push(...departamentos);
        }

        if (usuario) {
            query += ' AND cuadrecostos.IdUsuario = ?';
            params.push(usuario);
        }

        if (fechaInicio && fechaFin) {
            query += ' AND cuadrecostos.fechacuadre BETWEEN ? AND ?';
            params.push(formatDateForInput(fechaInicio), formatDateForInput(fechaFin));
        }

        if (idInventario) {
            query += ' AND cuadrecostos.Idcuadre = ?';
            params.push(idInventario);
        }

        if (numeroFactura) {
            query += ' AND cuadrecostos.NoFactura = ?';
            params.push(numeroFactura);
        }

        if (serie) {
            query += ' AND cuadrecostos.Serie = ?';
            params.push(serie);
        }

        if (upc) {
            query += ' AND cuadrecostos.Upc = ?';
            params.push(upc.padStart(13, '0'));
        }

        // Si no se ha aplicado ningún filtro, limitar los resultados para evitar sobrecarga
        if (params.length === 0) {
            query += ' LIMIT 1000'; // Ajusta este número según sea necesario
        }

        const result = await connection.query(query, params);
        Swal.close();
        updateDataTable(result);

        Swal.fire({
            icon: 'success',
            title: 'Búsqueda completada',
            text: `Se encontraron ${result.length} resultados.`,
            timer: 2000,
            showConfirmButton: false
        });

    } catch (error) {
        console.error('Error al realizar la búsqueda:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error en la búsqueda',
            text: 'Ocurrió un error al buscar los datos.',
            footer: `<details>
                        <summary>Detalles del error (para soporte técnico)</summary>
                        <p>${error.message}</p>
                        <p>Stack: ${error.stack}</p>
                    </details>`,
            confirmButtonText: 'Entendido'
        });
    } finally {
        if (connection) {
            await connection.close();
        }
    }
}
function formatDateForInput(dateString) {
    const date = new Date(dateString + 'T00:00:00Z');
    const localDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
    return localDate.toISOString().split('T')[0];
}
function updateDataTable(data) {
    const table = document.getElementById('data-table');
    const tbody = table.querySelector('tbody');
    tbody.innerHTML = '';

    data.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.Idcuadre}</td>
            <td>${row.Upc}</td>
            <td>${row.Descripcion}</td>
            <td>${row.Departamento}</td>
            <td>${row.Proveedor}</td>
            <td>${row.CantidadIngresada}</td>
            <td>${row.BonificacionIngresada}</td>
            <td>${formatofecha(row.FechaFactura)}</td>
            <td>${row.NoFactura}</td>
            <td>${row.Serie}</td>
            <td>${row.costosistema}</td>
            <td>${row.costofacturado}</td>
            <td>${row.Costofiscal}</td>
            <td>${row.diferencia}</td>
            <td>${row.sucursal}</td>
            <td>${formatofecha(row.fechacuadre)}</td>
            <td>${row.Usuario}</td>
            <td>${row.NombreRazon}</td>
        `;
        tbody.appendChild(tr);
    });
}
function exportToExcel() {
    // Obtener la tabla
    const table = document.getElementById('data-table');
    
    // Convertir la tabla a una matriz de datos
    const data = Array.from(table.querySelectorAll('tr')).map(row => 
        Array.from(row.querySelectorAll('th, td')).map(cell => cell.textContent)
    );
    
    // Crear una nueva hoja de trabajo
    const ws = xlsx.utils.aoa_to_sheet(data);
    
    // Formatear la columna UPC como texto
    const range = xlsx.utils.decode_range(ws['!ref']);
    const upcColumnIndex = 1; // Asumiendo que UPC es la segunda columna (índice 1)
    
    for (let row = range.s.r + 1; row <= range.e.r; row++) {
        const cellAddress = xlsx.utils.encode_cell({r: row, c: upcColumnIndex});
        if (ws[cellAddress]) {
            ws[cellAddress].t = 's'; // Establecer el tipo de celda como string
            ws[cellAddress].v = String(ws[cellAddress].v).padStart(13, '0'); // Asegurar 13 dígitos
            ws[cellAddress].z = '@'; // Aplicar formato de texto
        }
    }
    
    // Crear un nuevo libro de trabajo
    const wb = xlsx.utils.book_new();
    
    // Añadir la hoja de trabajo al libro
    xlsx.utils.book_append_sheet(wb, ws, "Historial de Cuadre");
    
    // Generar el archivo XLSX
    const wbout = xlsx.write(wb, {bookType:'xlsx', type:'binary'});
    
    // Convertir a un Blob
    const blob = new Blob([s2ab(wbout)], {type:"application/octet-stream"});
    
    // Crear un enlace de descarga
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = 'historial_cuadre.xlsx';
    
    // Simular un clic en el enlace para iniciar la descarga
    document.body.appendChild(a);
    a.click();
    
    // Limpiar
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Mostrar alerta de confirmación
        Swal.fire({
            icon: 'success',
            title: 'Exportación Completada',
            text: 'El archivo de Excel se ha descargado exitosamente.',
            timer: 3000,
            showConfirmButton: false
        });
    }, 100);
}

// Función auxiliar para convertir string a ArrayBuffer
function s2ab(s) {
    const buf = new ArrayBuffer(s.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < s.length; i++) view[i] = s.charCodeAt(i) & 0xFF;
    return buf;
}
// Agregar evento al botón de búsqueda
document.getElementById('search-btn').addEventListener('click', performSearch);
document.getElementById('export-btn').addEventListener('click', exportToExcel);

// Capturar errores no manejados
window.addEventListener('error', function(event) {
    showError('Error Inesperado', 'Ha ocurrido un error inesperado en la aplicación', event.error);
});

// Capturar promesas rechazadas no manejadas
window.addEventListener('unhandledrejection', function(event) {
    showError('Error en Promesa No Manejada', 'Ha ocurrido un error en una operación asíncrona', event.reason);
});