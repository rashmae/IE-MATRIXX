import { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'File ID is required' });
  }

  // Safety: basic regex for Drive IDs
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return res.status(400).json({ error: 'Invalid file ID format' });
  }

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Attempt download via uc?export=download
    const driveUrl = `https://drive.google.com/uc?export=download&id=${id}`;
    
    const driveRes = await fetch(driveUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!driveRes.ok) {
      return res.status(driveRes.status).json({ error: `Drive error: ${driveRes.statusText}` });
    }

    const contentType = driveRes.headers.get('content-type');
    
    // Check if we got an HTML error page instead of a PDF
    if (contentType?.includes('text/html')) {
      return res.status(403).json({ error: 'The file is not public or has exceeded download quota. Please make the file "Anyone with the link" and try again.' });
    }

    const buffer = await driveRes.buffer();

    if (buffer.length < 1000) {
      return res.status(422).json({ error: 'Downloaded file is unexpectedly small. It might not be a valid PDF.' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="syllabus-${id}.pdf"`);
    res.setHeader('Cache-Control', 's-maxage=86400'); // Cache for 24h
    
    return res.send(buffer);
  } catch (error: any) {
    console.error('[Proxy Drive Error]', error);
    return res.status(500).json({ error: 'Failed to proxy file from Google Drive' });
  }
}
