import traverse from '@babel/traverse';
import generate from '@babel/generator';
import t from '@babel/types';
import remapping from '@ampproject/remapping';
import type { RawSourceMap } from '@ampproject/remapping/dist/types/types';
import { parse } from '@babel/parser';

const ALIAS = '$$kairo_hoc';
const STUB_FILENAME = '/transformed.$$';

export function transform(code: string, map?: RawSourceMap) {
  const ast = parse(code, {
    sourceType: 'module',
    sourceFilename: STUB_FILENAME,
  });
  traverse(ast, {
    Program: (path) => {
      path.unshiftContainer('body', [
        createImportDeclaration({
          from: '@kairo/vue',
          imports: [['withKairoComponent', '$$kairo_hoc']],
        }),
      ]);
    },
    ExportDefaultDeclaration: (path) => {
      const node = path.node.declaration;
      path.replaceWith(
        t.exportDefaultDeclaration(
          t.callExpression(t.identifier(ALIAS), [node as t.Expression])
        )
      );
      path.skip();
    },
  });

  const generated = generate(ast, {
    sourceMaps: true,
  });
  if (!map) {
    return generated;
  }
  const remapped = remapping(generated.map as RawSourceMap, (file) => {
    return file === STUB_FILENAME ? map : undefined;
  });
  return {
    code: generated.code,
    map: remapped as RawSourceMap,
  };
}

function createImportDeclaration({
  from,
  imports,
}: {
  from: string;
  imports: [string, string][];
}) {
  return t.importDeclaration(
    imports.map((s) =>
      t.importSpecifier(t.identifier(s[1]), t.identifier(s[0]))
    ),
    t.stringLiteral(from)
  );
}
