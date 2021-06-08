Object.defineProperty(exports, '__esModule', { value: true });

const { babel } = require('svelte-preprocess');

const t = require('babel-types');

function kairo(inputOptions = {}) {
    return async (args) => {
        const options = { ...inputOptions };
        const { attributes } = args;
        if (attributes.kairo) {
            if (options.plugins) {
                options.plugins = [...options.plugins, ...babelPlugin(attributes.kairo)]
            } else {
                options.plugins = babelPlugin(attributes.kairo)
            }
        }
        return await babel(options).script(args);
    }
}

function babelPlugin(level) {
    return [
        function () {
            return {
                visitor: {
                    Program(path) {
                        path.unshiftContainer('body', [createImportDeclaration({
                            from: '@kairo/svelte',
                            imports: [['beginScope', '__beginScope']],
                        }),
                        createImportDeclaration({
                            from: 'svelte',
                            imports: [['onDestroy', '__onDestroy'], ['setContext', '__setContext'], ['getContext', '__getContext'], ['onMount', '__onMount']],
                        }),
                        createScopedCall(level)
                        ]);
                        path.pushContainer('body', [
                            t.callExpression(
                                t.identifier('__endScope'),
                                []
                            )
                        ]);
                    }
                }
            };
        }
    ];
}

function createImportDeclaration({ from, imports }) {
    return t.importDeclaration(
        imports.map(s => t.importSpecifier(t.identifier(s[1]), t.identifier(s[0]))),
        t.stringLiteral(from)
    );
}

function createScopedCall(level) {
    return t.variableDeclaration(
        'const',
        [
            t.variableDeclarator(
                t.identifier('__endScope'),
                t.callExpression(
                    t.identifier('__beginScope'),
                    [
                        t.stringLiteral(String(level)),
                        t.identifier('__onDestroy'),
                        t.identifier('__setContext'),
                        t.identifier('__getContext'),
                        t.identifier('__onMount'),
                    ]
                )
            ),
        ]
    );
}

exports.kairo = kairo;
