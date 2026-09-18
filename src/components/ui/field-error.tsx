interface FieldErrorProps {
  id?: string
  children: React.ReactNode
}

export function FieldError({ id, children }: FieldErrorProps) {
  return <p id={id} role="alert">{children}</p>
}
