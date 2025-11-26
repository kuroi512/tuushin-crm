import * as React from 'react';
import { cn } from '@/lib/utils';

interface CheckboxProps extends Omit<React.ComponentProps<'input'>, 'type'> {
  onCheckedChange?: (checked: boolean) => void;
}

function Checkbox({ className, checked, onCheckedChange, onChange, ...props }: CheckboxProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onCheckedChange) {
      onCheckedChange(e.target.checked);
    }
    if (onChange) {
      onChange(e);
    }
  };

  return (
    <input
      type="checkbox"
      data-slot="checkbox"
      checked={checked}
      onChange={handleChange}
      className={cn(
        'border-input text-primary focus-visible:ring-ring/50 h-4 w-4 rounded shadow-xs transition-colors outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:border-ring',
        className,
      )}
      {...props}
    />
  );
}

export { Checkbox };
