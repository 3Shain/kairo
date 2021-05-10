Object.defineProperty(exports, '__esModule', { value: true });

const {
    transformer: typescriptTrans,
} = require('svelte-preprocess/dist/transformers/typescript');

const {
    factory,
    isIdentifier,
    isObjectBindingPattern,
    isArrayBindingPattern,
    SyntaxKind,
    createSourceFile,
    createPrinter,
    ScriptTarget,
    NodeFlags
} = require('typescript');

function kairo(options = {}) {
    return {
        typescript: async (args) => {
            const { content, attributes } = args;
            if (attributes.kairo) {
                const level =
                    attributes.kairo == 'root'
                        ? 'root'
                        : attributes.kairo == 'module'
                            ? 'module'
                            : 'component';

                const file = createSourceFile(
                    'component.ts',
                    content,
                    ScriptTarget.Latest
                );
                const tokens = [];
                const importsStatements = [];
                const propsStatement = [];
                const exportsStatements = [];
                const wrappingStatements = [];
                const reactiveStatements = [];
                for (const statement of file.statements) {
                    if (statement.kind == SyntaxKind.VariableStatement) {
                        if (
                            statement.modifiers &&
                            statement.modifiers.find(
                                (x) => x.kind == SyntaxKind.ExportKeyword
                            )
                        ) {
                            propsStatement.push(statement);
                        } else {
                            if (statement.declarationList) {
                                for (let dec of statement.declarationList
                                    .declarations) {
                                    if (isIdentifier(dec.name)) {
                                        if (dec.name.escapedText.endsWith('$$')) {
                                            reactiveStatements.push(factory.createVariableStatement(
                                                statement.modifiers,
                                                factory.createVariableDeclarationList([
                                                    dec
                                                ], statement.declarationList.flags)
                                            ));
                                        } else {
                                            tokens.push(dec.name.escapedText);
                                            wrappingStatements.push(factory.createVariableStatement(
                                                statement.modifiers,
                                                factory.createVariableDeclarationList([
                                                    dec
                                                ], statement.declarationList.flags)
                                            ));
                                        }
                                    } else if (
                                        isObjectBindingPattern(dec.name)
                                    ) {
                                        for (let bindingelmenet of dec.name
                                            .elements) {
                                            tokens.push(
                                                bindingelmenet.name.escapedText
                                            ); // might be error: nested binding
                                        }
                                        wrappingStatements.push(factory.createVariableStatement(
                                            statement.modifiers,
                                            factory.createVariableDeclarationList([
                                                dec
                                            ], statement.declarationList.flags)
                                        ));
                                    } else if (
                                        isArrayBindingPattern(dec.name)
                                    ) {
                                        for (let bindingelmenet of dec.name
                                            .elements) {
                                            tokens.push(
                                                bindingelmenet.name.escapedText
                                            ); // might be error: nested binding
                                        }
                                        wrappingStatements.push(factory.createVariableStatement(
                                            statement.modifiers,
                                            factory.createVariableDeclarationList([
                                                dec
                                            ], statement.declarationList.flags)
                                        ));
                                    } else {
                                        throw Error(
                                            'unknown variable name :' +
                                            JSON.stringify(dec.name)
                                        );
                                    }
                                }
                            } else {
                                throw Error('unknown variable statement?');
                            }
                        }
                    } else if (
                        statement.kind == SyntaxKind.FunctionDeclaration
                    ) {
                        tokens.push(statement.name.escapedText);
                        wrappingStatements.push(statement);
                    } else if (
                        statement.kind == SyntaxKind.ImportDeclaration ||
                        statement.kind == SyntaxKind.ImportEqualsDeclaration
                    ) {
                        importsStatements.push(statement);
                    } else if (
                        statement.kind == SyntaxKind.ExportAssignment ||
                        statement.kind == SyntaxKind.ExportDeclaration
                    ) {
                        exportsStatements.push(statement);
                    } else if (
                        statement.kind == SyntaxKind.LabeledStatement &&
                        statement.label.escapedText == '$'
                    ) {
                        reactiveStatements.push(statement);
                    } else {
                        wrappingStatements.push(statement);
                    }
                }
                const newFile = factory.createSourceFile([
                    ...importsStatements,
                    createImportDeclaration({
                        from: '@kairo/svelte',
                        imports: [['withKairo', '_withKairo']],
                    }),
                    createImportDeclaration({
                        from: 'svelte',
                        imports: [['onDestroy', '_onDestroy'],['setContext', '_setContext'],['getContext','_getContext'],['onMount','_onMount']],
                    }),
                    ...propsStatement,
                    ...reactiveStatements,
                    createScopedCall({
                        tokenList: tokens,
                        innerStatements: wrappingStatements,
                        level,
                    })
                ]);
                const printer = createPrinter();
                args.content = printer.printFile(newFile);
            }

            const transformer = options.transformer ? options.transformer : typescriptTrans;

            const ret = transformer({
                ...args,
                ...options,
            });
            return ret;
        },
    };
}

function createImportDeclaration({ from, imports }) {
    return factory.createImportDeclaration(
        undefined,
        undefined,
        factory.createImportClause(
            false,
            undefined,
            factory.createNamedImports(
                imports.map((s) =>
                    factory.createImportSpecifier(
                        factory.createIdentifier(s[0]),
                        factory.createIdentifier(s[1])
                    )
                )
            )
        ),
        factory.createStringLiteral(from)
    );
}

function createScopedCall({ tokenList, level, innerStatements }) {
    return factory.createVariableStatement(
        undefined,
        factory.createVariableDeclarationList(
            [
                factory.createVariableDeclaration(
                    factory.createObjectBindingPattern(
                        tokenList.map((x) => {
                            return factory.createBindingElement(
                                undefined,
                                undefined,
                                factory.createIdentifier(x)
                            );
                        })
                    ),
                    undefined,
                    undefined,
                    factory.createCallExpression(
                        factory.createIdentifier('_withKairo'),
                        undefined,
                        [
                            factory.createFunctionExpression(
                                undefined,
                                undefined,
                                undefined,
                                undefined,
                                [],
                                undefined,
                                factory.createBlock(
                                    [
                                        ...innerStatements,
                                        factory.createReturnStatement(
                                            factory.createObjectLiteralExpression(
                                                tokenList.map((x) =>
                                                    factory.createShorthandPropertyAssignment(
                                                        factory.createIdentifier(
                                                            x
                                                        ),
                                                        undefined
                                                    )
                                                ),
                                                true
                                            )
                                        ),
                                    ],
                                    true
                                )
                            ),
                            factory.createStringLiteral(level),
                            factory.createIdentifier('_onDestroy'),
                            factory.createIdentifier('_setContext'),
                            factory.createIdentifier('_getContext'),
                            factory.createIdentifier('_onMount'),
                        ]
                    )
                ),
            ],
            NodeFlags.Const | NodeFlags.BlockScoped
        )
    );
}

exports.kairo = kairo;
