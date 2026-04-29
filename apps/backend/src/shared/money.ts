// Money in integer cents (MYR). Never floats.
export const cents = (myr: number) => Math.round(myr * 100);
export const myr = (c: number) => c / 100;
export const formatMyr = (c: number) =>
  `RM ${(c / 100).toFixed(2)}`;
