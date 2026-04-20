export default function ErrorMessage({ message }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
      <p className="text-red-600 font-medium">⚠️ {message}</p>
      <p className="text-red-400 text-sm mt-1">Make sure the backend is running on port 8000.</p>
    </div>
  );
}
