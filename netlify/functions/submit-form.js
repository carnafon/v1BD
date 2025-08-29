import busboy from 'busboy';
import { Client } from '@neondatabase/serverless';
import { v2 as cloudinary } from 'cloudinary';

// Configura Cloudinary con tus variables de entorno de Netlify
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const contentType = event.headers['content-type'];
  
  try {
    if (contentType && contentType.includes('application/json')) {
      const client = new Client(process.env.DATABASE_URL);
      await client.connect();

      // Manejar el formulario de RSVP (JSON)
      const data = JSON.parse(event.body);
      const rsvpResult = await client.query(
        `INSERT INTO rsvps (nombre, email, telefono, asistir, menu, alergias, autobus, comentarios)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [data.nombre, data.email, data.telefono, data.asistir, data.menu, data.alergias_detalle, data.autobus, data.comentarios]
      );
      
      const rsvpId = rsvpResult.rows[0].id;
      
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
      await client.end();
      
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'RSVP received successfully!', rsvpId: rsvpId }),
      };
    } else if (contentType && contentType.includes('multipart/form-data')) {
      // Manejar el formulario de fotos (multipart/form-data)
      let rsvpId = null;
      const filesToUpload = [];
      const bb = busboy({ headers: event.headers });
      
      bb.on('file', (name, file, info) => {
        let fileData = Buffer.from([]);
        file.on('data', (data) => {
          fileData = Buffer.concat([fileData, data]);
        });
        file.on('end', () => {
          filesToUpload.push({
            name: info.filename,
            data: fileData
          });
        });
      });
      
      bb.on('field', (name, value, info) => {
        if (name === 'rsvpId') {
          rsvpId = value;
        }
      });
      
      return new Promise((resolve, reject) => {
        bb.on('finish', async () => {
          const client = new Client(process.env.DATABASE_URL);
          await client.connect();

          if (!rsvpId) {
            await client.end();
            return resolve({ statusCode: 400, body: 'RSVP ID not found' });
          }

          const photoUrls = [];
          for (const file of filesToUpload) {
            try {
              const result = await cloudinary.uploader.upload(`data:image/jpeg;base64,${file.data.toString('base64')}`, {
                folder: 'boda_oihane_ander'
              });
              photoUrls.push(result.secure_url);
              await client.query(
                `INSERT INTO photos (guest_id, url, nombre_archivo) VALUES ($1, $2, $3)`,
                [rsvpId, result.secure_url, file.name]
              );
            } catch (uploadError) {
              console.error('Error al subir a Cloudinary:', uploadError);
            }
          }
          await client.end();

          console.log('Fotos subidas a Cloudinary y URLs guardadas en Neon.');
          resolve({
            statusCode: 200,
            body: JSON.stringify({ message: 'Photos received and saved successfully!', urls: photoUrls }),
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
  }
}
