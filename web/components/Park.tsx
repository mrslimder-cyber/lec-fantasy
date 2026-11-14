// Fondo del estilo "Otoño": sin animación. Dos capas fijas de imagen:
//  - park-ground: el suelo pintado (detrás de todo)
//  - park-dapple: sombras de hojas con transparencia (por encima de todo, sin bloquear clics)
export function Park() {
  return (
    <>
      <div className="park-ground" aria-hidden="true" />
      <div className="park-dapple" aria-hidden="true" />
    </>
  );
}
