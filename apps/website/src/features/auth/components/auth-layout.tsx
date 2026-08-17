import type { ReactNode } from "react";
import { Link } from "react-router";

import authEditorialImage from "@/assets/auth-editorial.webp";

export const AuthLayout = ({ children }: { children: ReactNode }) => (
  <main className="grid min-h-svh bg-background lg:grid-cols-[minmax(0,1.05fr)_minmax(28rem,0.95fr)]">
    <section className="relative hidden min-h-svh overflow-hidden border-r lg:block">
      <img alt="" className="absolute inset-0 size-full object-cover" src={authEditorialImage} />
      <div className="absolute inset-0 bg-gradient-to-t from-[#10243e]/80 via-transparent to-black/10" />
      <div className="absolute inset-x-0 bottom-0 p-10 text-white xl:p-14">
        <blockquote className="max-w-xl font-heading text-4xl leading-[1.08] font-medium xl:text-5xl">
          “Estudar também é encontrar relações entre aquilo que parecia disperso.”
        </blockquote>
      </div>
    </section>

    <section className="flex min-h-svh flex-col px-5 py-6 sm:px-10 lg:px-14 xl:px-20">
      <header className="flex items-center justify-between">
        <Link className="font-heading text-2xl font-semibold tracking-tight" to="/login">
          Lazúli
        </Link>
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Sua base de estudos
        </span>
      </header>

      <div className="flex flex-1 items-center justify-center py-12">
        <div className="w-full max-w-[25rem]">{children}</div>
      </div>
    </section>
  </main>
);
