"use client";

import { useRouter } from "next/navigation";
import DealForm from "@/components/DealForm";
import { dealsRepo } from "@/lib/storage";

export default function NewDealPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Add a deal</h1>
        <p className="mt-1 text-sm text-slate-600">
          Enter what you know — the engine fills the rest.
        </p>
      </div>
      <DealForm
        onSubmit={(input) => {
          const deal = dealsRepo.create(input);
          router.push(`/deals/${deal.id}`);
        }}
        onCancel={() => router.push("/")}
      />
    </div>
  );
}
