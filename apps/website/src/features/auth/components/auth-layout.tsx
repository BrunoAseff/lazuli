import type { ReactNode } from "react";
import { Link } from "react-router";

import { LapisField } from "@/components/brand/lapis-field.tsx";
import { LazuliWordmark } from "@/components/brand-mark.tsx";
import { LegalLinks } from "@/features/legal/legal-links.tsx";

export const AuthLayout = ({ children }: { children: ReactNode }) => (
  <main className="grid min-h-svh bg-background lg:grid-cols-[minmax(0,1.05fr)_minmax(28rem,0.95fr)]">
    <section className="relative isolate hidden min-h-svh overflow-hidden lg:block">
      {/* The brand material in place of a stock photo: the stone and a line about studying. */}
      <LapisField className="absolute inset-0" />
      <blockquote className="on-stone absolute inset-x-0 bottom-0 max-w-2xl p-10 font-reading text-3xl leading-tight font-medium text-balance xl:p-14 xl:text-4xl">
        “Estudar também é encontrar relações entre aquilo que parecia disperso.”
      </blockquote>
    </section>

    <section className="flex min-h-svh flex-col px-5 py-6 sm:px-10 lg:px-14 xl:px-20">
      <header className="flex items-center justify-between">
        <Link
          className="inline-flex items-center gap-2 font-heading text-lg font-medium tracking-tight"
          to="/"
        >
          <LazuliWordmark />
        </Link>
      </header>

      <div className="flex flex-1 items-center justify-center py-12">
        <div className="w-full max-w-[25rem]">{children}</div>
      </div>
      <LegalLinks newTab className="pb-2" />
    </section>
  </main>
);
