"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import DealForm from "@/components/DealForm";
import { dealsRepo } from "@/lib/storage";
import type { Deal } from "@/lib/types";

export default function EditDealPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id as string;
  const [deal, setDeal] = useState<Deal | undefined>();

  useEffect(() => {
    setDeal(dealsRepo.get(id));
  }, [id]);

  if (!deal) {
    return (
      <div className="card p-8 text-center text-sm text-slate-600">
        Deal not found.{" "}
        <Link href="/" className="text-brand-600 underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Edit deal</h1>
        <p className="mt-1 text-sm text-slate-600">
          Update {deal.name}. Analysis recomputes automatically.
        </p>
      </div>
      <DealForm
        initial={deal}
        submitLabel="Save changes"
        onSubmit={(input) => {
          dealsRepo.update(id, input);
          router.push(`/deals/${id}`);
        }}
        onCancel={() => router.push(`/deals/${id}`)}
      />
    </div>
  );
}
