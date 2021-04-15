Object.defineProperty(exports, "__esModule", { value: true });

const { transformer: typescriptTrans } = require('svelte-preprocess/dist/transformers/typescript');

const ts = require('typescript');
const { factory, isIdentifier, isObjectBindingPattern, isArrayBindingPattern } = require('typescript');

function kairo(
    options = {}
) {
    return {
        typescript: async (args) => {
            const {
                content,
                attributes
            } = args;
            if (attributes.kairo) {

                const file = ts.createSourceFile('component.ts', content, ts.ScriptTarget.Latest);
                const tokens = [];
                const importsStatements = [];
                const propsStatement = [];
                const exportsStatements = [];
                const wrappingStatements = [];
                const reactiveStatements = [];
                for (const statement of file.statements) {
                    if (statement.kind == ts.SyntaxKind.VariableStatement) {
                        if (statement.modifiers?.find(x => x.kind == ts.SyntaxKind.ExportKeyword)) {
                            propsStatement.push(statement);
                        } else {
                            // (statement as ts.VariableStatement)
                            if (statement.declarationList) {
                                for (let dec of statement.declarationList.declarations) {
                                    if (isIdentifier(dec.name)) {
                                        tokens.push(dec.name.escapedText);
                                    } else if (isObjectBindingPattern(dec.name)) {
                                        for (let bindingelmenet of dec.name.elements) {
                                            tokens.push(bindingelmenet.name.escapedText); // might be error: nested binding
                                        }
                                    } else if (isArrayBindingPattern(dec.name)) {
                                        for (let bindingelmenet of dec.name.elements) {
                                            tokens.push(bindingelmenet.name.escapedText); // might be error: nested binding
                                        }
                                    } else {
                                        throw Error('unknown variable name :' + JSON.stringify(dec.name))
                                    }
                                }
                            } else {
                                throw Error('unknown variable statement?');
                            }
                            wrappingStatements.push(statement);
                        }
                    } else if (statement.kind == ts.SyntaxKind.FunctionDeclaration) {
                        tokens.push(statement.name.escapedText)
                        wrappingStatements.push(statement);
                    }
                    else if (statement.kind == ts.SyntaxKind.ImportDeclaration || statement.kind == ts.SyntaxKind.ImportEqualsDeclaration) {
                        importsStatements.push(statement);
                    } else if (statement.kind == ts.SyntaxKind.ExportAssignment || statement.kind == ts.SyntaxKind.ExportDeclaration) {
                        exportsStatements.push(statement);
                    } else if (statement.kind == ts.SyntaxKind.LabeledStatement && statement.label.escapedText == "$") {
                        reactiveStatements.push(statement);
                    }
                    else {
                        wrappingStatements.push(statement);
                    }
                }
                const newFile = ts.factory.createSourceFile([
                    ...importsStatements,
                    createImportDeclaration({
                        from: '@kairo/svelte',
                        imports: [['withKairo', '_withKairo']]
                    }),
                    ...propsStatement,
                    createScopedCall({
                        tokenList: tokens,
                        innerStatements: wrappingStatements
                    }),
                    ...reactiveStatements
                ]);
                const printer = ts.createPrinter();
                args.content = printer.printFile(newFile);
            }

            const ret = typescriptTrans({
                ...args,
                ...options
            });
            return ret;
        }
    }
}

function createImportDeclaration({
    from,
    imports
}) {
    return ts.factory.createImportDeclaration(
        undefined,
        undefined,
        ts.factory.createImportClause(false,
            undefined,
            ts.factory.createNamedImports(imports.map(s => ts.factory.createImportSpecifier(
                ts.factory.createIdentifier(s[0]),
                ts.factory.createIdentifier(s[1])
            )))
        ),
        ts.factory.createStringLiteral(from)
    )
}

function createScopedCall({
    tokenList,
    innerStatements
}) {
    return ts.factory.createVariableStatement(
        undefined,
        ts.factory.createVariableDeclarationList([
            ts.factory.createVariableDeclaration(
                ts.factory.createObjectBindingPattern(
                    tokenList.map(x => {
                        return ts.factory.createBindingElement(undefined, undefined,
                            ts.factory.createIdentifier(x))
                    })
                ),
                undefined,
                undefined,
                ts.factory.createCallExpression(
                    factory.createIdentifier("_withKairo"),
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
                                [...innerStatements,
                                factory.createReturnStatement(factory.createObjectLiteralExpression(
                                    tokenList.map(x => factory.createShorthandPropertyAssignment(
                                        factory.createIdentifier(x),
                                        undefined
                                    )),
                                    true
                                ))],
                                true
                            )
                        )
                    ]
                )
            )
        ], ts.NodeFlags.Const | ts.NodeFlags.BlockScoped)
    )
}

exports.kairo = kairo;