export const AuthFormHeader = ({ description, title }: { description: string; title: string }) => (
  <div className="mb-6 space-y-2">
    <h1 className="page-title">{title}</h1>
    <p className="text-sm leading-6 text-muted-foreground">{description}</p>
  </div>
);
