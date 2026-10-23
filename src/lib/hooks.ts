"use client";

import * as React from "react";

const noopSubscribe = () => () => {};

/** true sólo en cliente tras hidratar (portales, APIs del navegador). */
export function useMounted() {
  return React.useSyncExternalStore(noopSubscribe, () => true, () => false);
}

/** Estado local que se reinicia cuando cambia el valor que llega por props. */
export function useSyncedState<T>(value: T) {
  const [state, setState] = React.useState(value);
  const [prev, setPrev] = React.useState(value);
  if (prev !== value) {
    setPrev(value);
    setState(value);
  }
  return [state, setState] as const;
}

/** Ejecuta `onChange` durante el render cuando `value` cambia (patrón "ajustar estado al cambiar props"). */
export function useOnChange<T>(value: T, onChange: (v: T) => void) {
  const [prev, setPrev] = React.useState(value);
  if (prev !== value) {
    setPrev(value);
    onChange(value);
  }
}
