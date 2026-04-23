import { useEffect } from "react";
import { useRouter } from "next/router";
import { SessionProvider } from "next-auth/react";
import Layout from "../components/Layout";
import ConsumerLayout from "../components/ConsumerLayout";
import DinerLayout from "../components/DinerLayout";
import { AuthProvider, useAuth } from "../context/AuthContext";
import "../styles/globals.css";

const PUBLIC_ROUTES = ["/", "/login", "/signup"];
const NO_LAYOUT_ROUTES = ["/onboarding"];

function homePath(user) {
  if (!user) return "/login";
  if (user.account_type === "staff") return "/staff-portal";
  if (!user.onboarding_completed) return "/onboarding";
  if (user.account_type === "consumer") return "/consumer/dashboard";
  if (user.account_type === "diner") return "/diner/dashboard";
  return "/dashboard";
}

function AppContent({ Component, pageProps }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const isPublic = PUBLIC_ROUTES.includes(router.pathname);
  const isOnboarding = router.pathname === "/onboarding";
  const isConsumerRoute = router.pathname.startsWith("/consumer");
  const isDinerRoute = router.pathname.startsWith("/diner");
  const isRestaurantRoute = !isConsumerRoute && !isDinerRoute && !isPublic && !isOnboarding;

  useEffect(() => {
    if (loading) return;
    if (!user && !isPublic && !isOnboarding) {
      router.replace("/login");
      return;
    }
    // Staff accounts skip onboarding — always go to staff portal
    if (user && user.account_type === "staff") {
      if (!isPublic && router.pathname !== "/staff-portal") {
        router.replace("/staff-portal");
      }
      return;
    }
    // Also check localStorage to avoid race condition when onboarding just completed
    // (React state update is async, but localStorage is set synchronously by updateUser)
    const onboardingDone = user?.onboarding_completed || (() => {
      try { return JSON.parse(localStorage.getItem("user") || "{}").onboarding_completed; } catch { return false; }
    })();
    if (user && !onboardingDone && !isOnboarding && !isPublic) {
      router.replace("/onboarding");
      return;
    }
    if (user && isPublic && router.pathname !== "/") {
      router.replace(homePath(user));
      return;
    }
    if (user && user.onboarding_completed && isOnboarding) {
      router.replace(homePath(user));
      return;
    }
    if (user && !isPublic && !isOnboarding) {
      const type = user.account_type;
      // null account_type means new social user — onboarding will handle it
      if (!type) return;
      if (type === "consumer" && !isConsumerRoute) {
        router.replace("/consumer/dashboard");
      } else if (type === "diner" && !isDinerRoute) {
        router.replace("/diner/dashboard");
      } else if (type === "restaurant" && (isConsumerRoute || isDinerRoute)) {
        router.replace("/dashboard");
      }
    }
  }, [user, loading, isPublic, isOnboarding, isConsumerRoute, isDinerRoute, router]);

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

  if (isPublic || isOnboarding) {
    return <Component {...pageProps} />;
  }

  if (!user) return null;

  if (user.account_type === "staff") {
    return <Component {...pageProps} />;
  }

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

export default function App({ Component, pageProps: { session, ...pageProps } }) {
  return (
    <SessionProvider session={session}>
      <AuthProvider>
        <AppContent Component={Component} pageProps={pageProps} />
      </AuthProvider>
    </SessionProvider>
  );
}
