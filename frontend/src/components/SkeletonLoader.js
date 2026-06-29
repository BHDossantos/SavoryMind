function Bar({ w = "w-full", h = "h-4" }) {
  return <div className={`${w} ${h} bg-gray-200 rounded-lg animate-pulse`} />;
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Bar w="w-2/3" h="h-4" />
          <Bar w="w-1/2" h="h-3" />
        </div>
      </div>
      <Bar h="h-3" />
      <Bar w="w-4/5" h="h-3" />
      <div className="flex gap-2 pt-1">
        <Bar w="w-16" h="h-6" />
        <Bar w="w-16" h="h-6" />
        <Bar w="w-16" h="h-6" />
      </div>
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-gray-50">
      <Bar w="w-1/4" h="h-4" />
      <Bar w="w-1/5" h="h-4" />
      <Bar w="w-1/6" h="h-4" />
      <Bar w="w-1/6" h="h-4" />
      <div className="ml-auto flex gap-2">
        <Bar w="w-8" h="h-8" />
        <Bar w="w-8" h="h-8" />
      </div>
    </div>
  );
}

export function SkeletonStatCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
      <Bar w="w-1/2" h="h-3" />
      <Bar w="w-1/3" h="h-8" />
      <Bar w="w-2/3" h="h-3" />
    </div>
  );
}

export default function SkeletonLoader({ type = "cards", count = 6 }) {
  if (type === "table") {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex gap-4">
          {[..."Item Category Price Orders"].split(" ").map((h, i) => (
            <Bar key={i} w="w-20" h="h-3" />
          ))}
        </div>
        {Array.from({ length: count }).map((_, i) => <SkeletonRow key={i} />)}
      </div>
    );
  }

  if (type === "stats") {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: count }).map((_, i) => <SkeletonStatCard key={i} />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}
