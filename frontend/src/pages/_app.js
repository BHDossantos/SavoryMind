import { useEffect } from "react";
import { useRouter } from "next/router";
import Layout from "../components/Layout";
import ConsumerLayout from "../components/ConsumerLayout";
import DinerLayout from "../components/DinerLayout";
import { AuthProvider, useAuth } from "../context/AuthContext";
import "../styles/globals.css";

const PUBLIC_ROUTES = ["/", "/login", "/signup"];

function homePath(user) {
  if (!user) return "/login";
  if (user.account_type === "consumer") return "/consumer/dashboard";
  if (user.account_type === "diner") return "/diner/dashboard";
  return "/dashboard";
}

function AppContent({ Component, pageProps }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const isPublic = PUBLIC_ROUTES.includes(router.pathname);
  const isConsumerRoute = router.pathname.startsWith("/consumer");
  const isDinerRoute = router.pathname.startsWith("/diner");
  const isRestaurantRoute = !isConsumerRoute && !isDinerRoute && !isPublic;

  useEffect(() => {
    if (loading) return;
    if (!user && !isPublic) {
      router.replace("/login");
      return;
    }
    if (user && isPublic && router.pathname !== "/") {
      router.replace(homePath(user));
      return;
    }
    if (user && !isPublic) {
      const type = user.account_type;
      if (type === "consumer" && !isConsumerRoute) {
        router.replace("/consumer/dashboard");
      } else if (type === "diner" && !isDinerRoute) {
        router.replace("/diner/dashboard");
      } else if (type === "restaurant" && (isConsumerRoute || isDinerRoute)) {
        router.replace("/dashboard");
      }
    }
  }, [user, loading, isPublic, isConsumerRoute, isDinerRoute, router]);

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

  if (user.account_type === "consumer") {
    return (
      <ConsumerLayout>
        <Component {...pageProps} />
      </ConsumerLayout>
    );
  }

  if (user.account_type === "diner") {
    return (
      <DinerLayout>
        <Component {...pageProps} />
      </DinerLayout>
    );
  }

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
