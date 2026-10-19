"use client";

import Link from "next/link";
import { useLocalized } from "@/lib/i18n/localized";
import { useStoreText } from "@/lib/i18n/storeI18n";
import { cn } from "@/lib/utils";
import type { StoreCategory } from "@/types/store";
import { CategoryImage } from "./CategoryTile";
import { useLocalePath } from "@/lib/i18n";

// The first cover is the big one; the rest are smaller, as in the approved design.
export function CategoryCovers({ categories, title }: { categories: StoreCategory[]; title?: string }) {
  const t = useStoreText();
  const localePath = useLocalePath();
  const pick = useLocalized();

  if (categories.length === 0) return null;
  return (
    <section className="pt-8 md:pt-12">
      <h2 className="mb-4 text-2xl font-bold tracking-tight text-ink md:mb-5 md:text-[32px]">{title ?? t.browseByCategory}</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
        {categories.map((c, index) => {
          const name = pick(c.name, c.nameEn);
          const tagline = pick(c.tagline, c.taglineEn);
          const big = index === 0;
          return (
            <Link
              key={c.id}
              href={localePath(`/products/c/${c.slug}`)}
              className={cn(
                "relative flex min-h-11 flex-col overflow-hidden rounded-3xl text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-apple-blue/20",
                !c.coverImage && "bg-mist",
                big && "col-span-2 md:col-span-2"
              )}
            >
              {/* With a cover the photo fills the card and the title sits on a frosted bar laid over it;
                  without one the title stays above the placeholder so it never covers the name. */}
              <div
                className={cn(
                  "px-4 pb-4 pt-4 md:px-6 md:pt-6",
                  big && "px-5 pt-6 md:px-8 md:pt-8",
                  c.coverImage &&
                    "absolute inset-x-0 top-0 z-10 border-b border-white/80 bg-gradient-to-br from-white/60 to-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_6px_18px_rgba(0,0,0,0.06)] backdrop-blur-sm backdrop-saturate-150"
                )}
              >
                <h3 className={cn("font-bold uppercase tracking-tight text-ink-tertiary", big ? "text-[26px] md:text-4xl" : "text-[19px] md:text-2xl")}>{name}</h3>
                <p className={cn("mt-1 uppercase text-ink/80", big ? "text-[15px] md:text-lg" : "text-[13px] md:text-[15px]")}>
                  {tagline || t.categoryItems(c.productCount)}
                </p>
              </div>
              <CategoryImage
                src={c.coverImage}
                name={name}
                className={cn("w-full flex-1", big ? "aspect-[16/10] md:aspect-[2/1]" : "aspect-[4/5]")}
              />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
