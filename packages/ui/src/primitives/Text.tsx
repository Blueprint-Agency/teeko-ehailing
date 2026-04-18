import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { cn } from '../utils/cn';

type Tone = 'primary' | 'secondary' | 'faint' | 'brand' | 'danger';
type Weight = 'regular' | 'medium' | 'bold';

export interface TextProps extends RNTextProps {
  tone?: Tone;
  weight?: Weight;
  className?: string;
}

const toneClass: Record<Tone, string> = {
  primary: 'text-ink-primary',
  secondary: 'text-ink-secondary',
  faint: 'text-ink-faint',
  brand: 'text-primary',
  danger: 'text-danger',
};

const weightClass: Record<Weight, string> = {
  regular: 'font-body',
  medium: 'font-label',
  bold: 'font-headline',
};

export function Text({ tone = 'primary', weight = 'regular', className, ...rest }: TextProps) {
  return <RNText {...rest} className={cn(toneClass[tone], weightClass[weight], className)} />;
}
