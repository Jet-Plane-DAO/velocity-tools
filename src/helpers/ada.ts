export const LOVELACE_MULTIPLIER = 1000000;
export const ADA_SYMBOL = '₳';
const NumberFormat = { LOVELACE_MULTIPLIER };
export default NumberFormat;

export const formatNumber = (
  input: number,
  maximumFractionDigits = 2,
  notation: any = 'standard',
) =>
  Intl.NumberFormat('en-US', {
    maximumFractionDigits,
    notation,
  }).format(input);

export const toAda = (
  input: number,
  maximumFractionDigits = 0,
  notation = 'standard',
) => {
  if (!input) return input;
  const ada = input / LOVELACE_MULTIPLIER;
  return Number.isNaN(ada)
    ? input
    : `${formatNumber(ada, maximumFractionDigits, notation).toLocaleString()} ₳`;
};
