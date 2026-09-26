export const conIdLegado = <T extends { id: string }>(
  obj: T,
): T & { _id: string } => ({
  ...obj,
  _id: obj.id,
});

export const listaConIdLegado = <T extends { id: string }>(lista: T[]) =>
  lista.map(conIdLegado);
