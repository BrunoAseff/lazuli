import type { ReactNode } from "react";
import { Link } from "react-router";

import authEditorialImage from "@/assets/auth-editorial.webp";
import { BrandMark } from "@/components/brand-mark.tsx";
import { LegalLinks } from "@/features/legal/legal-links.tsx";

export const AuthLayout = ({ children }: { children: ReactNode }) => (
  <main className="grid min-h-svh bg-background lg:grid-cols-[minmax(0,1.05fr)_minmax(28rem,0.95fr)]">
    <section className="relative hidden min-h-svh overflow-hidden lg:block">
      <img alt="" className="absolute inset-0 size-full object-cover" src={authEditorialImage} />
      <div className="absolute inset-0 bg-gradient-to-t from-[#10243e]/80 via-transparent to-black/10" />
      <div className="absolute inset-x-0 bottom-0 p-10 text-white xl:p-14">
        <blockquote className="max-w-xl font-heading text-3xl leading-tight font-medium xl:text-4xl">
          “Estudar também é encontrar relações entre aquilo que parecia disperso.”
        </blockquote>
      </div>
    </section>

    <section className="flex min-h-svh flex-col px-5 py-6 sm:px-10 lg:px-14 xl:px-20">
      <header className="flex items-center justify-between">
        <Link
          className="inline-flex items-center gap-2 font-heading text-lg font-medium tracking-tight"
          to="/"
        >
          <BrandMark className="size-6" />
          Lazúli
        </Link>
      </header>

      <div className="flex flex-1 items-center justify-center py-12">
        <div className="w-full max-w-[25rem]">{children}</div>
      </div>
      <LegalLinks newTab className="pb-2" />
    </section>
  </main>
);
