export function debounce<TArgs extends unknown[]>(
  fn: (...args: TArgs) => Promise<void> | void,
  delayMs: number
): (...args: TArgs) => void {
  let timer: NodeJS.Timeout | undefined;

  return (...args: TArgs): void => {
    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      void fn(...args);
    }, delayMs);
  };
}
