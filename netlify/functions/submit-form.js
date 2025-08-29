import busboy from 'busboy';
import { Client } from '@neondatabase/serverless';

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const contentType = event.headers['content-type'];
  const client = new Client(process.env.DATABASE_URL);
  
  try {
    await client.connect();

    if (contentType && contentType.includes('application/json')) {
      // Manejar el formulario de RSVP (JSON)
      const data = JSON.parse(event.body);

      // Inserción en la tabla 'rsvps'
      const rsvpResult = await client.query(
        `INSERT INTO rsvps (nombre, email, telefono, asistir, menu, alergias, autobus, comentarios)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [data.nombre, data.email, data.telefono, data.asistir, data.menu, data.alergias_detalle, data.autobus, data.comentarios]
      );
      
      const rsvpId = rsvpResult.rows[0].id;
      
      // Manejar acompañantes dinámicamente
      for (let i = 1; ; i++) {
        const guestNameKey = `acomp_${i}_nombre`;
        if (data[guestNameKey]) {
          const guestMenuKey = `acomp_${i}_menu`;
          const guestAlergiasKey = `acomp_${i}_alergias_detalle`;
          
          await client.query(
            `INSERT INTO guests (rsvp_id, nombre, menu, alergias)
             VALUES ($1, $2, $3, $4)`,
            [rsvpId, data[guestNameKey], data[guestMenuKey], data[guestAlergiasKey]]
          );
        } else {
          break;
        }
      }

      console.log('Datos de RSVP guardados exitosamente. ID:', rsvpId);
      
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'RSVP received successfully!' }),
      };
    } else if (contentType && contentType.includes('multipart/form-data')) {
      // Manejar el formulario de fotos (multipart/form-data)
      const fields = {};
      const files = {};
      
      const bb = busboy({ headers: event.headers });
      
      bb.on('file', (name, file, info) => {
        let fileData = Buffer.from([]);
        file.on('data', (data) => {
          fileData = Buffer.concat([fileData, data]);
        });
        file.on('end', () => {
          files[name] = {
            filename: info.filename,
            mimetype: info.mimeType,
            data: fileData
          };
        });
      });
      
      bb.on('field', (name, value, info) => {
        fields[name] = value;
      });
      
      return new Promise((resolve, reject) => {
        bb.on('finish', async () => {
          console.log('Archivos recibidos:', files);
          console.log('Campos de texto:', fields);
          
          // Nota: Guardar fotos requiere un servicio externo como Cloudinary o S3.
          // Aquí puedes agregar la lógica para subir las fotos y luego guardar las URLs en tu base de datos.
          
          // Por ahora, solo confirmamos la recepción y registramos.
          resolve({
            statusCode: 200,
            body: JSON.stringify({ message: 'Photos received successfully!' }),
          });
        });
        
        bb.on('error', (err) => {
          console.error('Busboy error:', err);
          reject({
            statusCode: 500,
            body: 'Busboy error: ' + err.message,
          });
        });
        
        bb.end(Buffer.from(event.body, 'base64'));
      });
    } else {
      return {
        statusCode: 400,
        body: 'Unsupported Content-Type',
      };
    }
  } catch (error) {
    console.error('Error al procesar el formulario:', error.message);
    return {
      statusCode: 500,
      body: 'Error processing form submission: ' + error.message,
    };
  } finally {
    await client.end();
  }
}
