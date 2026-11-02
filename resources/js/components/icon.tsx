import { cn } from '@/lib/utils';
import { type IconProps as PhosphorIconProps } from '@phosphor-icons/react';

interface IconProps extends Omit<PhosphorIconProps, 'ref'> {
    iconNode: React.ComponentType<PhosphorIconProps>;
}

export function Icon({ iconNode: IconComponent, className, ...props }: IconProps) {
    return <IconComponent className={cn('h-4 w-4', className)} {...props} />;
}
