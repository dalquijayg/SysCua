const { ipcRenderer } = require('electron');
const odbc = require('odbc');
const conexionfacturas = 'DSN=facturas';
const Swal = require('sweetalert2');
const Chart = require('chart.js/auto');

document.addEventListener('DOMContentLoaded', () => {
    const mainNavButtons = document.querySelectorAll('.main-nav-button');
    const dropdownButton = document.querySelector('.dropdown .main-nav-button');
    const dropdownContent = document.querySelector('.dropdown-content');
    const submenuButtons = document.querySelectorAll('.submenu-button');
    const menuItems = document.querySelectorAll('.menu-item');
    const greetingText = document.getElementById('greetingText');
    const NombreUsuario = document.getElementById('userName');
    const welcomeText = document.getElementById('welcomeText');
    const welcomeIcon = document.querySelector('#welcomeMessage i');
    const mainContent = document.getElementById('mainContent');
    const dateFrom = document.getElementById('dateFrom');
    const dateTo = document.getElementById('dateTo');
    const updateChartsButton = document.getElementById('updateCharts');
    cargarDashboard();
    initializeDashboard();
    const chartInstances = {};
    function getCurrentDate() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    function initializeDashboard() {
        const currentDate = getCurrentDate();
        dateFrom.value = currentDate;
        dateTo.value = currentDate;
        cargarGraficos(currentDate, currentDate);
    }
    // Función para cambiar entre pestañas principales
    function switchTab(tabId) {
        mainNavButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.tab === tabId);
        });

        // Ocultar todos los submenús al cambiar de pestaña
        dropdownContent.classList.remove('show');
        document.querySelectorAll('.submenu-content').forEach(content => {
            content.classList.remove('show');
        });

        // Mostrar contenido según la pestaña seleccionada
        switch(tabId) {
            case 'Inicio':
                mainContent.innerHTML = '<h2>Bienvenido a la página de inicio</h2>';
                break;
            case 'Costos':
                mainContent.innerHTML = '<h2>Sección de Costos</h2><p>Seleccione una opción del menú desplegable.</p>';
                break;
            case 'GestionAdministracion':
                mainContent.innerHTML = '<h2>Gestión y Administración</h2><p>Contenido de gestión y administración.</p>';
                break;
        }
    }
    mainNavButtons.forEach(button => {
        button.addEventListener('click', () => {
            switchTab(button.dataset.tab);
        });
    });

    // Mostrar/ocultar el menú desplegable de Costos
    dropdownButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Evitar que el clic se propague
        dropdownContent.classList.toggle('show');
    });

    // Mostrar/ocultar submenús
    submenuButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation(); // Evitar que el clic se propague
            const submenuContent = button.nextElementSibling;
            submenuContent.classList.toggle('show');
        });
    });

    // Cerrar menús al hacer clic fuera de ellos
    document.addEventListener('click', (e) => {
        if (!e.target.matches('.dropdown, .dropdown *')) {
            dropdownContent.classList.remove('show');
            document.querySelectorAll('.submenu-content').forEach(content => {
                content.classList.remove('show');
            });
        }
    });

    // Función para alternar submenús
    function toggleSubmenu(menuItem) {
        const subMenu = menuItem.querySelector('.sub-menu');
        if (subMenu) {
            subMenu.classList.toggle('active');
        }
    }

    // Event listeners para los elementos del menú
    menuItems.forEach(item => {
        const span = item.querySelector('span');
        span.addEventListener('click', () => {
            toggleSubmenu(item);
        });
    });
    document.getElementById('cuadreFacturasLink').addEventListener('click', (e) => {
        e.preventDefault();
        ipcRenderer.send('open-cuadre-window');
    });
    document.getElementById('historialCuadresLink').addEventListener('click', (e) => {
        e.preventDefault();
        ipcRenderer.send('open-historial-window');
    });
    document.getElementById('criteriosCuadreLink').addEventListener('click', (e) => {
        e.preventDefault();
        ipcRenderer.send('open-criterio-window');
    });
    document.getElementById('ingresosLink').addEventListener('click', (e) => {
        e.preventDefault();
        ipcRenderer.send('open-ingresos-window');
    });
    document.getElementById('VMegared').addEventListener('click', (e) => {
        e.preventDefault();
        ipcRenderer.send('open-VMegared-window');
    });
    document.getElementById('VSurti').addEventListener('click', (e) => {
        e.preventDefault();
        ipcRenderer.send('open-VSurti-window');
    });
    document.getElementById('NSurti').addEventListener('click', (e) => {
        e.preventDefault();
        ipcRenderer.send('open-NSurti-window');
    });
    document.getElementById('NMegared').addEventListener('click', (e) => {
        e.preventDefault();
        ipcRenderer.send('open-NMegared-window');
    });
    document.getElementById('FBonificaciones').addEventListener('click', (e) => {
        e.preventDefault();
        ipcRenderer.send('open-FBonificaciones-window');
    });
    document.getElementById('VBodegonaAntigua').addEventListener('click', (e) => {
        e.preventDefault();
        ipcRenderer.send('open-VBodegonaAntigua-window');
    });
    document.getElementById('NBodegonaAntigua').addEventListener('click', (e) => {
        e.preventDefault();
        ipcRenderer.send('open-NBodegonaAntigua-window');
    });
    // Función para obtener el saludo e icono según la hora del día
    function getGreetingAndIcon() {
        const hour = new Date().getHours();
        if (hour < 12) {
            return { greeting: "¡Buenos días!", icon: "fa-sun" };
        } else if (hour < 18) {
            return { greeting: "¡Buenas tardes!", icon: "fa-cloud-sun" };
        } else {
            return { greeting: "¡Buenas noches!", icon: "fa-moon" };
        }
    }
    function getRandomWelcomeMessage() {
        const messages = [
            "¡Que tengas una excelente jornada!",
            "Esperamos que logres todos tus objetivos hoy.",
            "¡Mucho éxito en tus tareas del día!",
            "Recuerda: cada día es una nueva oportunidad.",
            "Tu actitud determina tu dirección. ¡Ánimo!",
            "Hoy es un gran día para hacer grandes cosas."
        ];
        return messages[Math.floor(Math.random() * messages.length)];
    }
    // Función para mostrar el mensaje de bienvenida
    function showWelcomeMessage() {
        const userName = localStorage.getItem('userName'); // Asumimos que guardamos el nombre en localStorage
        const { greeting, icon } = getGreetingAndIcon();
        
        greetingText.textContent = greeting;
        NombreUsuario.textContent = userName || "Usuario";
        welcomeText.textContent = getRandomWelcomeMessage();
        welcomeIcon.className = `fas ${icon}`;
    }
    async function cargarDashboard() {
        let connection;
        try {
            connection = await odbc.connect(conexionfacturas);
    
            // Ejecución de los procedimientos almacenados
            const consultas = [
                { query: 'CALL TotalCuadrexdia()', name: 'TotalCuadrexdia' },
                { query: 'CALL TotalCuadrexdiafactura()', name: 'TotalCuadrexdiafactura' },
                { query: 'CALL Upsceros()', name: 'Upsceros' },
                { query: 'CALL MontoFacturadocero()', name: 'MontoFacturadocero' }
            ];
    
            for (let consulta of consultas) {
                try {
                    const result = await connection.query(consulta.query);
                    mostrarResultado(consulta.name, result);
                } catch (queryError) {
                    console.error(`Error ejecutando ${consulta.name}:`, queryError);
                    
                    // Mostrar un mensaje detallado del error con SweetAlert2
                    Swal.fire({
                        icon: 'error',
                        title: `Error en ${consulta.name}`,
                        text: `Hubo un problema al ejecutar la consulta: ${queryError.message}`,
                        footer: `<p><strong>Código de Error:</strong> ${queryError.code || 'No disponible'}</p>`,
                        confirmButtonText: 'Revisar'
                    });
                }
            }
    
        } catch (error) {
            console.error('Error al conectar a la base de datos:', error);
    
            // Mostrar alerta si hay un problema general de conexión o ejecución
            Swal.fire({
                icon: 'error',
                title: 'Error al Conectar',
                text: `Hubo un problema al conectar con la base de datos: ${error.message}`,
                footer: `<p><strong>Código de Error:</strong> ${error.code || 'No disponible'}</p>`,
                confirmButtonText: 'Revisar'
            });
    
        } finally {
            if (connection) {
                await connection.close();
            }
        }
    }
    
    // Función para mostrar los resultados en el dashboard
    function mostrarResultado(name, result) {
        switch (name) {
            case 'TotalCuadrexdia':
                document.getElementById('totalCuadrexdia').textContent = result[0]['COUNT(Idcuadre)'] || 0;
                break;
            case 'TotalCuadrexdiafactura':
                document.getElementById('totalCuadrexdiafactura').textContent = result[0]['COUNT(DISTINCT Idcuadre)'] || 0;
                break;
            case 'Upsceros':
                document.getElementById('totalUpsceros').textContent = result[0].TotalIpsceros || 0;
                break;
            case 'MontoFacturadocero':
                document.getElementById('totalMontoFacturadocero').textContent = result[0]['COUNT(Idcuadre)'] || 0;
                break;
            default:
                console.warn(`Resultado no manejado para ${name}`);
        }
    }
    updateChartsButton.addEventListener('click', () => {
        const fromDate = dateFrom.value;
        const toDate = dateTo.value;
        if (fromDate && toDate) {
            cargarGraficos(fromDate, toDate);
        } else {
            Swal.fire('Error', 'Por favor seleccione ambas fechas', 'error');
        }
    });
    async function cargarGraficos(fromDate, toDate) {
        let connection;
        try {
            connection = await odbc.connect(conexionfacturas);

            // Cargar datos para el gráfico de Total Cuadres por Día
            const totalCuadresQuery = `CALL totalcuadrepordia('${fromDate}', '${toDate}')`;
            const totalCuadresResult = await connection.query(totalCuadresQuery);
            crearGraficoCircular('totalCuadresPorDiaChart', totalCuadresResult, 'Factura', 'Usuario');

            // Cargar datos para el gráfico de Total SKUs Cuadrados
            const totalSkusQuery = `CALL totalcuadrepordiaskus('${fromDate}', '${toDate}')`;
            const totalSkusResult = await connection.query(totalSkusQuery);
            crearGraficoCircular('totalSkusCuadradosChart', totalSkusResult, 'SkusCuadrados', 'Usuario');

        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error al Conectar',
                text: `Hubo un problema al consultar: ${error.message}`,
                footer: `<p><strong>Código de Error:</strong> ${error.code || 'No disponible'}</p>`,
                confirmButtonText: 'Revisar'
            });
        } finally {
            if (connection) {
                await connection.close();
            }
        }
    }

    function crearGraficoCircular(canvasId, data, valorKey, labelKey) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error(`El elemento canvas con id ${canvasId} no existe`);
            return;
        }
        const ctx = canvas.getContext('2d');
        
        if (chartInstances[canvasId] && typeof chartInstances[canvasId].destroy === 'function') {
            chartInstances[canvasId].destroy();
        }

        const labels = data.map(item => item[labelKey]);
        const valores = data.map(item => {
            const valor = item[valorKey];
            return typeof valor === 'bigint' ? Number(valor) : valor;
        });

        console.log('Labels:', labels);
        console.log('Valores:', valores);

        let total = valores.reduce((a, b) => a + b, 0);
        let titleText = canvasId === 'totalCuadresPorDiaChart' 
            ? `Total Cuadres por Día (Usuario) - Total: ${total} Facturas`
            : `Total SKUs Cuadrados por Día (Usuario) - Total: ${total} SKUs`;

        chartInstances[canvasId] = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: valores,
                    backgroundColor: [
                        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40',
                        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: titleText
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed !== null) {
                                    label += context.parsed;
                                    if (canvasId === 'totalCuadresPorDiaChart') {
                                        label += ' Facturas';
                                    } else if (canvasId === 'totalSkusCuadradosChart') {
                                        label += ' SKUs Cuadrados';
                                    }
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
    }
    // Mostrar el mensaje de bienvenida al cargar la página
    showWelcomeMessage();

    // Activar la pestaña "Inicio" por defecto
    switchTab('Inicio');
});