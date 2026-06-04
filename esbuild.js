const esbuild = require('esbuild');
const { copyFileSync, mkdirSync } = require('fs');
const { dirname } = require('path');

const watch = process.argv.includes('--watch');

const wasmAssets = [
    {
        from: 'node_modules/web-tree-sitter/web-tree-sitter.wasm',
        to: 'out/web-tree-sitter.wasm',
    },
    {
        from: 'node_modules/tree-sitter-python/tree-sitter-python.wasm',
        to: 'out/tree-sitter-python.wasm',
    },
];

function copyWasmAssets() {
    for (const asset of wasmAssets) {
        mkdirSync(dirname(asset.to), { recursive: true });
        copyFileSync(asset.from, asset.to);
    }
}

const copyWasmPlugin = {
    name: 'copy-wasm-assets',
    setup(build) {
        build.onEnd((result) => {
            if (result.errors.length === 0) {
                copyWasmAssets();
            }
        });
    },
};

/** @type {import('esbuild').BuildOptions} */
const buildOptions = {
    entryPoints: ['src/extension.ts'],
    bundle: true,
    outdir: 'out',
    platform: 'node',
    format: 'cjs',
    target: 'node18',
    external: ['vscode', 'web-tree-sitter'],
    sourcemap: true,
    minify: false,
    logLevel: 'info',
    plugins: [copyWasmPlugin],
};

if (watch) {
    esbuild.context(buildOptions).then((ctx) => {
        ctx.watch();
        console.log('Watching for changes...');
    });
} else {
    esbuild.build(buildOptions).catch(() => process.exit(1));
}
