export default function ErrorMessage({ message, onRetry }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
      <p className="text-red-600 font-medium">⚠️ {message}</p>
      <p className="text-red-400 text-sm mt-1">Please check your connection and try again.</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-3 btn-primary text-sm">
          Retry
        </button>
      )}
    </div>
  );
}
