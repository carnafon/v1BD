import { Client } from '@neondatabase/serverless';

export async function handler(event, context) {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const client = new Client(process.env.DATABASE_URL);
    try {
        await client.connect();
        
        const query = `
            SELECT 
                rsvps.*,
                JSON_AGG(DISTINCT guests.*) AS acompanantes,
                JSON_AGG(DISTINCT photos.*) AS fotos
            FROM 
                rsvps
            LEFT JOIN 
                guests ON rsvps.id = guests.rsvp_id
            LEFT JOIN
                photos ON rsvps.id = photos.guest_id
            GROUP BY 
                rsvps.id
            ORDER BY 
                rsvps.fecha_envio DESC;
        `;
        
        const res = await client.query(query);
        const data = res.rows;

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        };
    } catch (error) {
        console.error('Error fetching data:', error);
        return {
            statusCode: 500,
            body: 'Error fetching data: ' + error.message,
        };
    } finally {
        try {
            if (client && client.end) {
                await client.end();
            }
        } catch (err) {
            console.error('Error al cerrar la conexión a la DB:', err);
        }
    }
}
