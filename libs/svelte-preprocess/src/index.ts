import traverse from '@babel/traverse';
import { parse } from '@babel/parser';
import generate from '@babel/generator';
import t from '@babel/types';
import remapping from '@ampproject/remapping';
import type { RawSourceMap } from '@ampproject/remapping/dist/types/types';
import sveltePreprocess from 'svelte-preprocess';

const STUB_FILENAME = '/transformed.$$';

function interopDefault<T>(e: T): { default: T } {
  // @ts-ignore
  return e && typeof e === 'object' && 'default' in e ? e : { default: e };
}

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
          ...transform(
            result.code,
            typeof result.map === 'string'
              ? JSON.parse(result.map)
              : (result.map as any)
          ),
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

  interopDefault(traverse).default(ast, {
    Program: (path) => {
      const args = [
        path.scope.generateUid('onDestroy'),
        path.scope.generateUid('setContext'),
        path.scope.generateUid('getContext'),
        path.scope.generateUid('onMount'),
      ];
      const beginScopeUid = path.scope.generateUid('beginScope');
      const endScopeUid = path.scope.generateUid('endScope');
      path.unshiftContainer('body', [
        createImportDeclaration({
          from: '@kairo/svelte',
          imports: [['beginScope', beginScopeUid]],
        }),
        createImportDeclaration({
          from: 'svelte',
          imports: [
            ['onDestroy', args[0]],
            ['setContext', args[1]],
            ['getContext', args[2]],
            ['onMount', args[3]],
          ],
        }),
        t.variableDeclaration('const', [
          t.variableDeclarator(
            t.identifier(endScopeUid),
            t.callExpression(t.identifier(beginScopeUid), [
              t.identifier(args[0]),
              t.identifier(args[1]),
              t.identifier(args[2]),
              t.identifier(args[3]),
            ])
          ),
        ]),
      ]);
      path.pushContainer('body', [
        t.callExpression(t.identifier(endScopeUid), []),
      ]);
      path.skip();
    },
  });

  const generated = interopDefault(generate).default(ast, {
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
    map: {
      ...map,
      names: remapped.names,
      mappings: remapped.mappings,
    },
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
