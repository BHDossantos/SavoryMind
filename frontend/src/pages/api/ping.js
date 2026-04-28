export default async function handler(req, res) {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.savorymind.net';
    const response = await fetch(`${backendUrl}/health`, {
      signal: AbortSignal.timeout(10000),
    });
    const data = await response.json();
    res.status(200).json({ ok: true, backend: data });
  } catch (err) {
    res.status(200).json({ ok: false, error: err.message });
  }
}
