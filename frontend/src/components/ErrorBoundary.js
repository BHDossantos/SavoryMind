import React from "react";
import Link from "next/link";

export default class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
          <div className="text-center max-w-sm">
            <div className="text-6xl mb-4">🍳</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Something burnt in the kitchen</h1>
            <p className="text-gray-500 mb-8 text-sm leading-relaxed">
              An unexpected error occurred. Try refreshing the page — if it keeps happening, head back home.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  this.setState({ hasError: false });
                  window.location.reload();
                }}
                className="bg-gray-900 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-700 transition-colors"
              >
                Refresh page
              </button>
              <Link
                href="/"
                className="bg-gray-100 text-gray-700 px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors"
              >
                Go home
              </Link>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
