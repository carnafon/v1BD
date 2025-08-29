import busboy from 'busboy';

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
        bb.on('finish', () => {
          console.log('Archivos recibidos:', files);
          console.log('Campos de texto:', fields);
          
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
        
        // El cuerpo del evento de Netlify está codificado en Base64
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
