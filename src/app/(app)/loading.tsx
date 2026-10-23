import { GlassSkeleton } from "@/components/glass/primitives";

export default function Loading() {
  return (
    <div className="fm-safe-top flex flex-col gap-4 pt-6" aria-busy="true">
      <GlassSkeleton className="h-10 w-48 rounded-2xl" />
      <GlassSkeleton className="h-5 w-72 rounded-xl" />
      <GlassSkeleton className="mt-4 h-40 w-full rounded-[28px]" />
      <div className="grid grid-cols-2 gap-3"><GlassSkeleton className="h-28 rounded-[24px]" /><GlassSkeleton className="h-28 rounded-[24px]" /></div>
      <GlassSkeleton className="h-24 w-full rounded-[24px]" />
    </div>
  );
}
