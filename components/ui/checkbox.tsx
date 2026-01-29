'use client';
import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, ...props }, ref) => {
    return (
      <div className="flex items-center gap-2">
        <input
          ref={ref}
          type="checkbox"
          id={id}
          className={cn(
            'h-4 w-4 rounded border-lmf-text-muted bg-lmf-surface',
            'checked:bg-lmf-primary checked:border-lmf-primary',
            'focus:ring-2 focus:ring-lmf-primary focus:ring-offset-0',
            className
          )}
          {...props}
        />
        {label && <label htmlFor={id} className="text-sm text-lmf-text cursor-pointer">{label}</label>}
      </div>
    );
  }
);
Checkbox.displayName = 'Checkbox';
