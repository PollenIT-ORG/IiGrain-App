let counter = 0;

export const nextVertexId = (): string => {
  counter += 1;
  return `v${counter}`;
};

export const resetVertexIds = (): void => {
  counter = 0;
};
