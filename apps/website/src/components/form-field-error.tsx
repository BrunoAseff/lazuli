export const FormFieldError = ({ id, message }: { id: string; message?: string }) =>
  message ? (
    <p className="text-xs text-destructive" id={id} role="alert">
      {message}
    </p>
  ) : null;
