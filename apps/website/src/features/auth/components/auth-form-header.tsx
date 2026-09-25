export const AuthFormHeader = ({ description, title }: { description: string; title: string }) => (
  <div className="mb-7 space-y-2">
    <h1 className="font-heading text-[clamp(2rem,3.5vw,2.25rem)] leading-[1.06] font-medium tracking-[-0.025em]">
      {title}
    </h1>
    <p className="text-sm leading-6 text-muted-foreground">{description}</p>
  </div>
);
