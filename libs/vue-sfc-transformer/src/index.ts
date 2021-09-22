import traverse, { NodePath } from '@babel/traverse';
import generate from '@babel/generator';
import t from '@babel/types';
import remapping from '@ampproject/remapping';
import type { RawSourceMap } from '@ampproject/remapping/dist/types/types';
import { parse } from '@babel/parser';

const ALIAS = '$$kairo_hoc';
const STUB_FILENAME = '/transformed.$$';

export function transform(code: string, map?: RawSourceMap) {
  if (map.mappings.trim() === '') {
    return {
      code,
      map,
    };
  }
  const ast = parse(code, {
    sourceType: 'module',
    sourceFilename: STUB_FILENAME,
  });
  traverse(ast, {
    ExportDefaultDeclaration: (path) => {
      const program = path.parentPath as NodePath<t.Program>;
      const uid = program.scope.generateUid(ALIAS);
      program.unshiftContainer('body', [
        createImportDeclaration({
          from: '@kairo/vue',
          imports: [['patchComponent', uid]],
        }),
      ]);
      const node = path.node.declaration;
      path.replaceWith(
        t.exportDefaultDeclaration(
          t.callExpression(t.identifier(uid), [node as t.Expression])
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
  remapped.sourcesContent = undefined; // wtf / anyway it makes sourcemap work
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
