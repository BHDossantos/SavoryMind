import { useEffect } from "react";
import { useRouter } from "next/router";
import Layout from "../components/Layout";
import ConsumerLayout from "../components/ConsumerLayout";
import { AuthProvider, useAuth } from "../context/AuthContext";
import "../styles/globals.css";

const PUBLIC_ROUTES = ["/", "/login", "/signup"];
const CONSUMER_ROUTES = ["/consumer/dashboard", "/consumer/wine", "/consumer/music", "/consumer/profile", "/consumer/social"];
const RESTAURANT_ROUTES = ["/dashboard", "/menu", "/sentiment", "/recommendations", "/reports", "/restaurant/bookings", "/restaurant/crm", "/restaurant/staff", "/restaurant/predictions"];

function AppContent({ Component, pageProps }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const isPublic = PUBLIC_ROUTES.includes(router.pathname);
  const isConsumerRoute = router.pathname.startsWith("/consumer");
  const isRestaurantRoute = !isConsumerRoute;

  useEffect(() => {
    if (loading) return;
    if (!user && !isPublic) {
      router.replace("/login");
      return;
    }
    if (user && isPublic && router.pathname !== "/") {
      router.replace(user.account_type === "consumer" ? "/consumer/dashboard" : "/dashboard");
      return;
    }
    // Guard wrong account type accessing wrong section
    if (user && !isPublic) {
      if (user.account_type === "consumer" && !isConsumerRoute) {
        router.replace("/consumer/dashboard");
      } else if (user.account_type === "restaurant" && isConsumerRoute) {
        router.replace("/dashboard");
      }
    }
  }, [user, loading, isPublic, isConsumerRoute, router]);

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
