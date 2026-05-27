// Sprint 7 · Chore-T — Fixture PNG en memoria para tests E2E.
//
// En lugar de mantener un binario en el repo (con sus pitfalls: hash inestable
// en algunos editores, line-endings, AV escaneándolo), generamos un PNG válido
// mínimo (1×1 transparente, ~70 bytes) en runtime y lo entregamos como `File`
// a `setInputFiles`.
//
// Este buffer pasa `validarImagen` de src/lib/solicitudes.ts:
//   - mime = 'image/png' (en el wrapper del helper)
//   - size << 5 MB
//
// Para regenerar este buffer si quieres: bytes son de un PNG 1×1 RGBA opaco.

// Buffer hex de un PNG 1×1 transparente, válido (cabecera + IHDR + IDAT + IEND).
const PNG_BYTES_HEX =
  '89504E470D0A1A0A' +                           // signature
  '0000000D49484452' +                           // IHDR length+type
  '00000001000000010806000000' +                 // 1×1, RGBA, depth 8
  '1F15C489' +                                   // IHDR CRC
  '0000000D49444154' +                           // IDAT length+type
  '789C6200010000050001' +                       // IDAT data (deflate of 1 pixel)
  '0D0A2DB4' +                                   // IDAT CRC
  '0000000049454E44' +                           // IEND length+type
  'AE426082'                                     // IEND CRC

export const TEST_PNG_BUFFER = Buffer.from(PNG_BYTES_HEX, 'hex')

export const TEST_PNG_FILE = {
  name: 'test-image.png',
  mimeType: 'image/png',
  buffer: TEST_PNG_BUFFER,
}
