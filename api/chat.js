export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const lambdaUrl = process.env.LAMBDA_URL;
  const apiKey = process.env.ORCA_API_KEY;

  if (!lambdaUrl || !apiKey) {
    return res.status(500).json({
      error: 'Server is not configured. Set LAMBDA_URL and ORCA_API_KEY.'
    });
  }

  try {
    const upstream = await fetch(lambdaUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-orca-api-key': apiKey
      },
      body: JSON.stringify(req.body)
    });

    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', 'application/json');
    return res.send(text);
  } catch (error) {
    return res.status(502).json({
      error: error?.message || 'Failed to call upstream Lambda'
    });
  }
}
