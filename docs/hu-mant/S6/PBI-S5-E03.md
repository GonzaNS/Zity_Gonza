# PBI-S5-E03: Cambio de contraseña desde Perfil

## Historia de Usuario
**Como** usuario autenticado (residente, admin o técnico),
**Quiero** poder cambiar mi contraseña desde mi perfil,
**Para** mantener mi cuenta segura sin depender del administrador para resetearla.

## Criterios de Aceptación
1. La pantalla del perfil (`/perfil`) está dividida en dos pestañas claras: "Información" (para los datos personales) y "Seguridad".
2. La pestaña "Seguridad" debe solicitar: Contraseña actual, Nueva contraseña y Confirmar nueva contraseña.
3. Se debe validar un mínimo de 8 caracteres.
4. La contraseña actual debe validarse realizando una re-autenticación silenciosa antes de actualizar la cuenta.
5. Tras cambiar la contraseña, debe mostrarse un mensaje de éxito.
6. Si la contraseña actual es errónea 3 veces seguidas, se bloquea el formulario por 5 minutos (Rate Limit cliente).

## Decisiones Técnicas y Contexto
- **Re-autenticación**: La función `updateUser` no verifica la contraseña anterior por sí sola, simplemente la sobreescribe si el JWT está activo. Para prevenir que alguien con un terminal abierto lo cambie, se obliga al uso previo de `signInWithPassword` silencioso validando la contraseña actual primero.
- **Componentes Reutilizables**: Se integra el componente central `PasswordInput`, garantizando que la UX y la validación de visibilidad ("ojito") sea consistente.
- **Rate Limit Local**: Para cumplir con mitigantes de OWASP frente a fuerza bruta en interfaces de usuario, se usó un estado local de `bloqueadoHasta` guardado en React state.

## Archivos Modificados
- `src/pages/Perfil.tsx`: Refactorizado completo usando un layout de pestañas (tabs). Se dividió la lógica en info y seguridad. Implementación de estado temporal de bloqueo.
- (A nivel de ruteo/componentes, se asumió que los links en headers ya existían).

## Notas de Implementación (Mitigantes)
- **OWASP A07 (Identification and Authentication Failures)**: El formulario se bloquea por 5 minutos si hay 3 intentos de contraseña erróneos (`setTimeout` que libera el estado), evitando fuerza bruta manual directa desde esta vista.
- **Riesgo R5 (Token stealing)**: Se exige la contraseña antigua antes de permitir usar el JWT actual para la rotación de credenciales.
