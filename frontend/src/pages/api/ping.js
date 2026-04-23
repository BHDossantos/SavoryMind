export default async function handler(req, res) {
  try {
    const response = await fetch('https://savorymind-api.onrender.com/health', {
      signal: AbortSignal.timeout(10000),
    });
    const data = await response.json();
    res.status(200).json({ ok: true, backend: data });
  } catch (err) {
    res.status(200).json({ ok: false, error: err.message });
  }
}
