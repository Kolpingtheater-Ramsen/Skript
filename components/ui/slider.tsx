'use client';
import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  showValue?: boolean;
}

export const Slider = forwardRef<HTMLInputElement, SliderProps>(
  ({ className, label, showValue, value, id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-2">
        {(label || showValue) && (
          <div className="flex items-center justify-between">
            {label && <label htmlFor={id} className="text-sm text-lmf-text">{label}</label>}
            {showValue && <span className="text-sm text-lmf-text-muted">{value}</span>}
          </div>
        )}
        <input
          ref={ref}
          type="range"
          id={id}
          value={value}
          className={cn(
            'w-full h-2 rounded-lg appearance-none cursor-pointer bg-lmf-accent',
            '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4',
            '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-lmf-primary [&::-webkit-slider-thumb]:cursor-pointer',
            className
          )}
          {...props}
        />
      </div>
    );
  }
);
Slider.displayName = 'Slider';
