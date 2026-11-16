'use client';
import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { Button, cn, type ButtonVariant } from './ui';
import type { ActionState } from '@/lib/types';

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/** Form bound to a server action; shows success / error messages from the server. */
export function ActionForm({ action, children, className, confirm, resetOnSuccess, onSuccess, hideMessage, id }: {
  action: Action; children: React.ReactNode; className?: string; confirm?: string;
  resetOnSuccess?: boolean; onSuccess?: () => void; hideMessage?: boolean; id?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) {
      if (resetOnSuccess) ref.current?.reset();
      onSuccess?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return (
    <form
      ref={ref}
      id={id}
      action={formAction}
      className={className}
      onSubmit={(e) => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }}
    >
      {children}
      {!hideMessage && state?.error && (
        <p role="alert" className="mt-2 w-full rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {!hideMessage && state?.ok && (
        <p role="status" className="mt-2 w-full rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.ok}</p>
      )}
    </form>
  );
}

export function SubmitButton({ children, variant = 'default', size = 'default', className, name, value }: {
  children: React.ReactNode; variant?: ButtonVariant; size?: 'default' | 'sm' | 'lg' | 'icon'; className?: string; name?: string; value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} disabled={pending} className={cn(className)} name={name} value={value}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </Button>
  );
}
