export const AuthFormHeader = ({ description, title }: { description: string; title: string }) => (
  <div className="mb-8 space-y-2">
    <h1 className="font-heading text-4xl leading-none font-medium tracking-tight sm:text-5xl">
      {title}
    </h1>
    <p className="text-sm leading-6 text-muted-foreground">{description}</p>
  </div>
);
