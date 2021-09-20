import traverse from '@babel/traverse';
import { parse } from '@babel/parser';
import generate from '@babel/generator';
import t from '@babel/types';
import remapping from '@ampproject/remapping';
import type { RawSourceMap } from '@ampproject/remapping/dist/types/types';
import sveltePreprocess from 'svelte-preprocess';

const STUB_FILENAME = '/transformed.$$';

export default function preprocess(
  options: Parameters<typeof sveltePreprocess>[0]
) {
  const original = sveltePreprocess(options);
  return {
    ...original,
    script: async (options) => {
      const ret = original.script!(options);
      const result = ret instanceof Promise ? await ret : ret;
      if (options.attributes['kairo']) {
        return {
          ...result,
          ...transform(result.code, result.map as any),
        };
      }

      return result;
    },
  } as ReturnType<typeof sveltePreprocess>;
}

function transform(code: string, map?: RawSourceMap) {
  const ast = parse(code, {
    sourceType: 'module',
    sourceFilename: STUB_FILENAME,
  });

  traverse(ast, {
    Program: (path) => {
      const args = [
        path.scope.generateUidIdentifier('onDestroy'),
        path.scope.generateUidIdentifier('setContext'),
        path.scope.generateUidIdentifier('getContext'),
        path.scope.generateUidIdentifier('onMount'),
      ];
      path.unshiftContainer('body', [
        createImportDeclaration({
          from: '@kairo/svelte',
          imports: [['beginScope', path.scope.generateUid('beginScope')]],
        }),
        createImportDeclaration({
          from: 'svelte',
          imports: [
            ['onDestroy', '__onDestroy'],
            ['setContext', '__setContext'],
            ['getContext', '__getContext'],
            ['onMount', '__onMount'],
          ],
        }),
        t.variableDeclaration('const', [
          t.variableDeclarator(
            t.identifier('__endScope'),
            t.callExpression(t.identifier('__beginScope'), [
              t.identifier('__onDestroy'),
              t.identifier('__setContext'),
              t.identifier('__getContext'),
              t.identifier('__onMount'),
            ])
          ),
        ]),
      ]);
      path.pushContainer('body', [
        t.callExpression(t.identifier('__endScope'), []),
      ]);
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
