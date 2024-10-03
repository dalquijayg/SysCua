const { ipcRenderer } = require('electron');
const odbc = require('odbc');
const conexionfacturas = 'DSN=facturas';
const Swal = require('sweetalert2');

document.addEventListener('DOMContentLoaded', function() {
    const proveedorSelect = document.getElementById('proveedorSelect');
    const criterioTextarea = document.getElementById('criterioTextarea');
    const charCount = document.getElementById('charCount');
    const guardarBtn = document.getElementById('guardarBtn');

    // Cargar proveedores
    cargarProveedores();
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
    // Actualizar contador de caracteres
    criterioTextarea.addEventListener('input', function() {
        charCount.textContent = `${this.value.length} / 250`;
    });
    proveedorSelect.addEventListener('change', mostrarCriterioActivo);
    // Guardar criterio
    guardarBtn.addEventListener('click', guardarCriterio);

    async function cargarProveedores() {
        const sql = `
            SELECT 
                proveedores_facturas.Id, 
                proveedores_facturas.Nombre
            FROM 
                proveedores_facturas
        `;

        try {
            const connection = await conectar();
            const result = await connection.query(sql);
            await connection.close();

            result.forEach(proveedor => {
                const option = document.createElement('option');
                option.value = proveedor.Id;
                option.textContent = proveedor.Nombre;
                proveedorSelect.appendChild(option);
            });
        } catch (error) {
            mostrarError('Error al cargar proveedores', error);
        }
    }
    async function mostrarCriterioActivo() {
        const idProveedor = proveedorSelect.value;
        if (!idProveedor) {
            criterioTextarea.value = '';
            charCount.textContent = '0 / 250';
            return;
        }

        const sql = `
            SELECT Criterio_Cuadre
            FROM HistorialCriterioCuadres
            WHERE IdProveedor = ? AND Activo = 1
        `;

        try {
            const connection = await conectar();
            const result = await connection.query(sql, [idProveedor]);
            await connection.close();

            if (result.length > 0) {
                criterioTextarea.value = result[0].Criterio_Cuadre;
                charCount.textContent = `${criterioTextarea.value.length} / 250`;
            } else {
                criterioTextarea.value = '';
                charCount.textContent = '0 / 250';
            }
        } catch (error) {
            mostrarError('Error al cargar criterio activo', error);
        }
    }
    async function guardarCriterio() {
        const idProveedor = proveedorSelect.value;
        const nombreProveedor = proveedorSelect.options[proveedorSelect.selectedIndex].text;
        const criterioCuadre = criterioTextarea.value;

        if (!idProveedor) {
            mostrarError('Error', 'Por favor, seleccione un proveedor.');
            return;
        }

        if (!criterioCuadre.trim()) {
            mostrarError('Error', 'Por favor, escriba un criterio de cuadre.');
            return;
        }

        try {
            const connection = await odbc.connect(conexionfacturas);

            // Desactivar criterios anteriores
            const sqlDesactivar = `
                UPDATE HistorialCriterioCuadres
                SET Activo = 0
                WHERE IdProveedor = ? AND Activo = 1
            `;
            await connection.query(sqlDesactivar, [idProveedor]);

            // Insertar nuevo criterio
            const sqlInsertar = `
                INSERT INTO HistorialCriterioCuadres 
                (IdProveedor, Proveedor, FechaInicio, Criterio_Cuadre, Activo)
                VALUES 
                (?, ?, NOW(), ?, 1)
            `;
            await connection.query(sqlInsertar, [idProveedor, nombreProveedor, criterioCuadre]);

            await connection.close();

            Swal.fire('Éxito', 'El criterio se ha guardado correctamente.', 'success');
            
            // Limpiar campos después de guardar
            proveedorSelect.value = '';
            criterioTextarea.value = '';
            charCount.textContent = '0 / 250';
        } catch (error) {
            mostrarError('Error al guardar', error);
        }
    }

    function mostrarError(titulo, error) {
        console.error(error);
        Swal.fire(titulo, error.message || 'Ha ocurrido un error.', 'error');
    }
});