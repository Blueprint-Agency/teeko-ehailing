export const simulateLatency = (min = 400, max = 1200): Promise<void> =>
  new Promise((resolve) => {
    const duration = min + Math.random() * (max - min);
    setTimeout(resolve, duration);
  });
