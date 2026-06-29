import Link from "next/link";
import { useTranslation } from "react-i18next";

export default function ErrorPage({ statusCode }) {
  const { t } = useTranslation();
  const is404 = statusCode === 404;
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="text-center max-w-sm">
        <div className="text-7xl mb-4">{is404 ? "🍽️" : "🍳"}</div>
        <p className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-2">
          {statusCode || t("errorPage.errorLabel")}
        </p>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          {is404 ? t("errorPage.title404") : t("errorPage.titleOther")}
        </h1>
        <p className="text-gray-500 text-sm mb-8 leading-relaxed">
          {is404 ? t("errorPage.sub404") : t("errorPage.subOther")}
        </p>
        <div className="flex gap-3 justify-center">
          {!is404 && (
            <button
              onClick={() => window.location.reload()}
              className="bg-gray-900 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-700 transition-colors"
            >
              {t("errorPage.refresh")}
            </button>
          )}
          <Link
            href="/"
            className="bg-gray-100 text-gray-700 px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors"
          >
            {t("errorPage.goHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}

ErrorPage.getInitialProps = ({ res, err }) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};
