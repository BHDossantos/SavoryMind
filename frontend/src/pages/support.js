import Head from "next/head";
import Link from "next/link";
import { useTranslation } from "react-i18next";

export default function Support() {
  const { t } = useTranslation();
  return (
    <>
      <Head>
        <title>{t("supportPage.headTitle")}</title>
        <meta name="description" content={t("supportPage.headDesc")} />
      </Head>
      <div className="min-h-screen bg-white">
        <div className="max-w-3xl mx-auto px-6 py-12">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">{t("supportPage.home")}</Link>

          <h1 className="text-3xl font-bold mt-6 mb-2">{t("supportPage.title")}</h1>
          <p className="text-sm text-gray-500 mb-10">{t("supportPage.subtitle")}</p>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">{t("supportPage.contactHeader")}</h2>
            <p className="text-gray-700 leading-relaxed mb-4">{t("supportPage.contactBody")}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-gray-200 rounded-xl p-5">
                <p className="text-xs uppercase tracking-wide font-semibold text-gray-500 mb-1">{t("supportPage.generalHelp")}</p>
                <a
                  href="mailto:hello@savorymind.net"
                  className="text-blue-600 font-medium text-base hover:underline"
                >
                  hello@savorymind.net
                </a>
                <p className="text-sm text-gray-600 mt-2">{t("supportPage.generalHelpDesc")}</p>
              </div>

              <div className="border border-gray-200 rounded-xl p-5">
                <p className="text-xs uppercase tracking-wide font-semibold text-gray-500 mb-1">{t("supportPage.privacyTitle")}</p>
                <a
                  href="mailto:privacy@savorymind.net"
                  className="text-blue-600 font-medium text-base hover:underline"
                >
                  privacy@savorymind.net
                </a>
                <p className="text-sm text-gray-600 mt-2">{t("supportPage.privacyDesc")}</p>
              </div>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">{t("supportPage.faqHeader")}</h2>

            <div className="space-y-5">
              <div>
                <p className="font-semibold text-gray-900">{t("supportPage.q1")}</p>
                <p className="text-sm text-gray-600 mt-1">{t("supportPage.a1")}</p>
              </div>

              <div>
                <p className="font-semibold text-gray-900">{t("supportPage.q2")}</p>
                <p className="text-sm text-gray-600 mt-1">{t("supportPage.a2")}</p>
              </div>

              <div>
                <p className="font-semibold text-gray-900">{t("supportPage.q3")}</p>
                <p className="text-sm text-gray-600 mt-1">{t("supportPage.a3")}</p>
              </div>

              <div>
                <p className="font-semibold text-gray-900">{t("supportPage.q4")}</p>
                <p className="text-sm text-gray-600 mt-1">
                  {t("supportPage.a4Prefix")} <a href="mailto:privacy@savorymind.net" className="text-blue-600">privacy@savorymind.net</a> {t("supportPage.a4Suffix")}
                </p>
              </div>

              <div>
                <p className="font-semibold text-gray-900">{t("supportPage.q5")}</p>
                <p className="text-sm text-gray-600 mt-1">{t("supportPage.a5")}</p>
              </div>

              <div>
                <p className="font-semibold text-gray-900">{t("supportPage.q6")}</p>
                <p className="text-sm text-gray-600 mt-1">{t("supportPage.a6")}</p>
              </div>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">{t("supportPage.statusHeader")}</h2>
            <p className="text-gray-700 leading-relaxed">{t("supportPage.statusBody")}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">{t("supportPage.otherLinks")}</h2>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/legal/privacy" className="text-blue-600 hover:underline">
                  {t("supportPage.privacyLink")}
                </Link>
              </li>
              <li>
                <Link href="/legal/terms" className="text-blue-600 hover:underline">
                  {t("supportPage.termsLink")}
                </Link>
              </li>
            </ul>
          </section>

        </div>
      </div>
    </>
  );
}
