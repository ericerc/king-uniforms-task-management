const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();

// Configuración del transportador de email
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'tu-email@gmail.com', // Reemplazar con el email de notificaciones
        pass: 'tu-contraseña' // Reemplazar con la contraseña de aplicación
    }
});

// Función que se ejecuta cada hora para verificar registros faltantes y tareas pendientes
exports.checkMissedRegistrationsAndTasks = functions.pubsub
    .schedule('every 1 hours')
    .onRun(async (context) => {
        const now = new Date();
        const currentDay = now.toLocaleDateString('es-ES', { weekday: 'lowercase' });
        const currentHour = now.getHours().toString().padStart(2, '0') + ':' + 
                           now.getMinutes().toString().padStart(2, '0');

        // Verificar registros de clientes faltantes
        await checkMissedClientRegistrations(now, currentDay, currentHour);
        
        // Verificar tareas de mantenimiento pendientes
        await checkPendingMaintenanceTasks(now, currentDay, currentHour);
    });

async function checkMissedClientRegistrations(now, currentDay, currentHour) {
    // Obtener todos los clientes
    const clientsSnapshot = await admin.firestore()
        .collection('lists')
        .doc('clients')
        .get();

    const clients = clientsSnapshot.data().items || [];

    // Filtrar clientes que deberían estar registrados ahora
    const missedClients = clients.filter(client => {
        if (typeof client === 'object' && client.frequency) {
            return client.frequency.some(freq => 
                freq.day === currentDay && 
                freq.time === currentHour
            );
        }
        return false;
    });

    // Verificar si estos clientes se han registrado hoy
    for (const client of missedClients) {
        const registrationsSnapshot = await admin.firestore()
            .collection('driverEntries')
            .where('clientName', '==', client.name)
            .where('timestamp', '>=', new Date(now.setHours(0, 0, 0, 0)))
            .get();

        if (registrationsSnapshot.empty) {
            // Enviar notificación
            await sendClientNotification(client.name, currentDay, currentHour);
        }
    }
}

async function checkPendingMaintenanceTasks(now, currentDay, currentHour) {
    // Obtener todas las tareas de mantenimiento
    const tasksSnapshot = await admin.firestore()
        .collection('maintenanceTasks')
        .get();

    const tasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Filtrar tareas que deberían estar completadas ahora
    const pendingTasks = tasks.filter(task => {
        if (task.frequency && task.area) {
            return task.frequency.some(freq => 
                freq.day === currentDay && 
                freq.time === currentHour &&
                !task.completed
            );
        }
        return false;
    });

    // Enviar notificación por cada tarea pendiente
    for (const task of pendingTasks) {
        await sendTaskNotification(task.title, task.area, currentDay, currentHour);
    }
}

async function sendClientNotification(clientName, day, time) {
    const mailOptions = {
        from: 'notificaciones@kinguniforms.com',
        to: 'admin@kinguniforms.com', // Reemplazar con el email del administrador
        subject: 'Cliente no registrado - Alerta',
        html: `
            <h2>Alerta de Registro Faltante</h2>
            <p>El cliente <strong>${clientName}</strong> no ha sido registrado en la fecha y hora programada:</p>
            <ul>
                <li>Día: ${day}</li>
                <li>Hora: ${time}</li>
            </ul>
            <p>Por favor, verifique el registro de este cliente.</p>
            <p>Saludos,<br>Equipo de King Uniforms</p>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Email enviado para cliente faltante: ${clientName}`);
    } catch (error) {
        console.error('Error enviando email de cliente:', error);
    }
}

async function sendTaskNotification(taskTitle, area, day, time) {
    const mailOptions = {
        from: 'notificaciones@kinguniforms.com',
        to: 'admin@kinguniforms.com', // Reemplazar con el email del administrador
        subject: 'Tarea de Mantenimiento Pendiente - Alerta',
        html: `
            <h2>Alerta de Tarea Pendiente</h2>
            <p>La siguiente tarea de mantenimiento no ha sido completada:</p>
            <ul>
                <li>Tarea: <strong>${taskTitle}</strong></li>
                <li>Área: ${area}</li>
                <li>Día: ${day}</li>
                <li>Hora programada: ${time}</li>
            </ul>
            <p>Por favor, verifique el estado de esta tarea.</p>
            <p>Saludos,<br>Equipo de King Uniforms</p>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Email enviado para tarea pendiente: ${taskTitle}`);
    } catch (error) {
        console.error('Error enviando email de tarea:', error);
    }
} 