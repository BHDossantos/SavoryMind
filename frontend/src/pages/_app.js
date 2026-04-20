import { useEffect } from "react";
import { useRouter } from "next/router";
import Layout from "../components/Layout";
import { AuthProvider, useAuth } from "../context/AuthContext";
import "../styles/globals.css";

const PUBLIC_ROUTES = ["/", "/login", "/signup"];

function AppContent({ Component, pageProps }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const isPublic = PUBLIC_ROUTES.includes(router.pathname);

  useEffect(() => {
    if (loading) return;
    if (!user && !isPublic) {
      router.replace("/login");
    }
  }, [user, loading, isPublic, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-4xl mb-3">🧠</div>
          <p className="text-gray-500 text-sm">Loading SavoryMind...</p>
        </div>
      </div>
    );
  }

  if (isPublic) {
    return <Component {...pageProps} />;
  }

  if (!user) return null;

  return (
    <Layout>
      <Component {...pageProps} />
    </Layout>
  );
}

export default function App({ Component, pageProps }) {
  return (
    <AuthProvider>
      <AppContent Component={Component} pageProps={pageProps} />
    </AuthProvider>
  );
}
