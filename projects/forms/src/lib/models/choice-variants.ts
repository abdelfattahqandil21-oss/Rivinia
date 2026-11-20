export interface RadioOption {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

export type RadioVariant = 'inline' | 'stacked';
export type ToggleVariant = 'switch' | 'checkbox';
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
