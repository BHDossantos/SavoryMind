import { useEffect } from "react";
import { useRouter } from "next/router";
import { SessionProvider } from "next-auth/react";
import Layout from "../components/Layout";
import ConsumerLayout from "../components/ConsumerLayout";
import DinerLayout from "../components/DinerLayout";
import ErrorBoundary from "../components/ErrorBoundary";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { getAccessToken } from "../services/api";
import { trackPageview, identify } from "../lib/analytics";
import "../styles/globals.css";

// Routes that must render without auth. Marketing surfaces, plus the
// legal + support pages every store submission requires to be publicly
// accessible (App Store / Play Store reject submissions whose privacy
// policy URL hides behind a login wall — and our own privacy policy
// declares these pages public, so the auth wrapper would be lying
// otherwise).
const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/signup",
  "/legal/privacy",
  "/legal/terms",
  "/support",
];
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

  // PostHog page_view + identify. Both no-op when NEXT_PUBLIC_POSTHOG_KEY
  // is unset. We capture page_view on routeChangeComplete (post-replace)
  // so the path matches what the user actually sees.
  useEffect(() => {
    const handleRouteChange = (url) => trackPageview(url);
    router.events.on("routeChangeComplete", handleRouteChange);
    // Initial pageview
    trackPageview(router.asPath);
    return () => router.events.off("routeChangeComplete", handleRouteChange);
  }, [router]);

  // Sync user identity to PostHog whenever auth state changes. Safe
  // properties only — never email/name (those stay in the backend
  // identify() call which has the same privacy-safe traits).
  useEffect(() => {
    if (user) {
      identify(user.id, {
        account_type: user.account_type,
      });
    }
  }, [user?.id, user?.account_type]);

  useEffect(() => {
    if (loading) return;
    // Guard: a freshly-set in-memory access token means we're authenticated
    // even before setUser's render commits (router.push fires synchronously
    // after setAccessToken+setUser).
    const hasToken = !!getAccessToken();
    if (!user && !hasToken && !isPublic && !isOnboarding) {
      router.replace("/login");
      return;
    }
    if (!user && hasToken) return;
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
    // Logged-in users get bounced away from /login + /signup (no point
    // re-authenticating). But /legal/* and /support stay accessible —
    // logged-in users should still be able to read the privacy policy
    // or contact support without being booted to their dashboard.
    if (user && isPublic && router.pathname !== "/"
        && !router.pathname.startsWith("/legal")
        && router.pathname !== "/support") {
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
    <ErrorBoundary>
      <SessionProvider session={session}>
        <AuthProvider>
          <AppContent Component={Component} pageProps={pageProps} />
        </AuthProvider>
      </SessionProvider>
    </ErrorBoundary>
  );
}
