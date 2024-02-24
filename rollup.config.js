import json from '@rollup/plugin-json'
import nodeResolve from '@rollup/plugin-node-resolve'
// import terser from '@rollup/plugin-terser'
import typescript from '@rollup/plugin-typescript'

export default {
  input: 'src/index.ts',
  output: {
    dir: 'dist',
    format: 'es'
  },
  plugins: [
    nodeResolve(),
    json(),
    typescript(),
    // terser(),
  ]
}
