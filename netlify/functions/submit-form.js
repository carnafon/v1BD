import { parse } from 'node-html-parser';
import { parse as parseMultipart } from 'multiparty';

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const contentType = event.headers['content-type'];

  try {
    if (contentType && contentType.includes('application/json')) {
      // Manejar el formulario de RSVP (JSON)
      const data = JSON.parse(event.body);
      
      console.log('Datos recibidos del formulario de RSVP:', data);
      
      // Aquí puedes enviar los datos por email o guardarlos.
      
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'RSVP received successfully!' }),
      };
    } else if (contentType && contentType.includes('multipart/form-data')) {
      // Manejar el formulario de fotos (multipart/form-data)
      const form = new parseMultipart();
      const { fields, files } = await new Promise((resolve, reject) => {
        form.parse(event.body, (err, fields, files) => {
          if (err) return reject(err);
          resolve({ fields, files });
        });
      });
      
      console.log('Archivos recibidos:', files);
      console.log('Campos de texto:', fields);
      
      // Aquí puedes procesar los archivos subidos.
      
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Photos received successfully!' }),
      };
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