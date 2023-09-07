/**
 * The validator function returns
 * - input number for number or strings that can be parsed to a number
 * - 0 for other
 *
 * @param {any} initialValue
 *              Value to be validated
 *
 * @return {number}
 *         input number or 0 for wrong input
 *
 * @example
 *        const validatedInitialValue = validateInitialValue(initialValue);
 */
export const validateInitialValue = (initialValue: any) => {
  if (typeof initialValue === 'string') {
    initialValue = parseInt(initialValue, 10);
  }

  if (isNaN(initialValue)) {
    console.log(
      'you really want to break the validation. Please pass a number as parameter. Defaulting to zero.',
    );
    initialValue = 0;
  }
  return initialValue;
};
