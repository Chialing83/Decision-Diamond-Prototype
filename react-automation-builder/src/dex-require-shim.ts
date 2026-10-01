/**
 * Rolldown-bundled CJS interop shim for @thryvlabs/dex-react.
 *
 * The package ships an .mjs file whose runtime helper explicitly throws
 * `Error("Calling `require` for \"react\" ...")` when `globalThis.require`
 * is undefined. This module installs a minimal `require` function that
 * resolves the two modules the stub ever asks for, so the dex code can
 * execute in a pure-ESM browser environment.
 *
 * IMPORTANT: this file must be imported before `@thryvlabs/dex-react`.
 * ES module side-effects run in import order, so keeping `import './dex-require-shim'`
 * as the first import in main.tsx is load-bearing.
 */
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import * as ReactJsxRuntime from 'react/jsx-runtime'

type RequireFn = (name: string) => unknown

const shim: RequireFn = (name) => {
  switch (name) {
    case 'react':
      return React
    case 'react-dom':
      return ReactDOM
    case 'react/jsx-runtime':
      return ReactJsxRuntime
    default:
      throw new Error(`dex-require-shim: require('${name}') is not shimmed`)
  }
}

// Only install if no require exists yet (don't clobber Node-like envs).
if (typeof (globalThis as Record<string, unknown>).require === 'undefined') {
  ;(globalThis as Record<string, unknown>).require = shim
}
