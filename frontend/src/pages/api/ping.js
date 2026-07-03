export default async function handler(req, res) {
  const backend = process.env.NEXT_PUBLIC_API_URL || process.env.BACKEND_URL || "https://api.savorymind.net";
  try {
    const response = await fetch(`${backend}/health`, {
      signal: AbortSignal.timeout(10000),
    });
    const data = await response.json();
    res.status(200).json({ ok: true, backend: data });
  } catch (err) {
    res.status(200).json({ ok: false, error: err.message });
  }
}
