const odbc = require('odbc');
const Swal = require('sweetalert2');

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');

    togglePassword.addEventListener('click', () => {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        togglePassword.classList.toggle('fa-eye');
        togglePassword.classList.toggle('fa-eye-slash');
    });

    loginForm.addEventListener('submit', handleLogin);
});

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const connection = await odbc.connect('DSN=facturas');
        const user = await authenticateUser(connection, username, password);

        if (user) {
            handleSuccessfulLogin(user);
        }

        await connection.close();
    } catch (error) {
        handleLoginError(error);
    }
}

async function authenticateUser(connection, username, password) {
    const userExists = await connection.query('SELECT 1 FROM usuarios WHERE Usuario = ?', [username]);

    if (userExists.length === 0) {
        Swal.fire({
            icon: 'error',
            title: 'Usuario no existe',
            text: 'El usuario ingresado no existe en el sistema.',
        });
        return null;
    }

    const result = await connection.query(
        'SELECT Id, CONCAT(usuarios.Nombres, " ", usuarios.Apellidos) AS NombreCompleto, Activo, IdNivel FROM usuarios WHERE Usuario = ? AND Password = ?',
        [username, password]
    );

    if (result.length === 0) {
        Swal.fire({
            icon: 'error',
            title: 'Contraseña incorrecta',
            text: 'La contraseña ingresada es incorrecta.',
        });
        return null;
    }

    return result[0];
}

function handleSuccessfulLogin(user) {
    console.log('Datos del usuario:', user); // Logging para depuración

    if (Number(user.Activo) !== 1) {
        Swal.fire({
            icon: 'error',
            title: 'Usuario desactivado',
            text: 'Tu cuenta está desactivada. Contacta al administrador.',
        });
    } else if (Number(user.IdNivel) !== 11 && Number(user.IdNivel) !== 30) {
        Swal.fire({
            icon: 'error',
            title: 'Sin permiso',
            text: 'No tienes permiso para acceder a esta aplicación.',
        });
    } else {
        localStorage.setItem('userName', user.NombreCompleto);
        localStorage.setItem('userId', user.Id);
        Swal.fire({
            icon: 'success',
            title: '¡Bienvenido!',
            text: `Inicio de sesión exitoso. Bienvenido, ${user.NombreCompleto}`,
        }).then(() => {
            window.location.href = 'Menu.html';
        });
    }
}

function handleLoginError(error) {
    console.error('Error de conexión:', error);
    Swal.fire({
        icon: 'error',
        title: 'Error de conexión',
        text: 'No se pudo conectar a la base de datos.',
    });
}