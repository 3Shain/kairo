import { ExecutorContext } from '@nrwl/devkit';
import { resolve, dirname } from 'path';
import copy from 'rollup-plugin-copy';
import { writeFile } from 'fs-extra';
import typescript from 'rollup-plugin-typescript2';
import { OutputOptions, rollup } from 'rollup';
import define from 'rollup-plugin-define';
import filesize from 'rollup-plugin-filesize';

interface Options {
  externals: string[];
  entry: string;
  bundleName: string;
  copy?: string[];
}

export default async function (
  _options: Options,
  context: ExecutorContext
): Promise<{ success: boolean }> {
  const projectRoot = context.workspace.projects[context.projectName].root;
  const projectAbsoluteRoot = resolve(context.root, projectRoot);
  const outDir = resolve('dist', projectRoot);

  const packageJson = require(resolve(projectAbsoluteRoot, 'package.json'));

  const external = [
    ..._options.externals,
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.peerDependencies ?? {}),
  ];

  const output = await rollup({
    plugins: [
      typescript({
        tsconfig: resolve(projectRoot, 'tsconfig.lib.json'),
        tsconfigOverride: {
          compilerOptions: {
            declarationDir: '../../dist',
          },
        },
        useTsconfigDeclarationDir: true,
      }),
      copy({
        targets: [
          {
            src: [
              resolve(projectRoot, 'README.md'),
              resolve(projectRoot, 'package.json'),
              ...(_options.copy?.map((x) => resolve(projectRoot, x)) ?? []),
            ],
            dest: outDir,
          },
        ],
        hook: 'writeBundle',
      }),
      define({
        replacements: {
          __DEV__: 'false',
          __TEST__: 'false',
        },
      }),
      filesize(),
    ],
    external,
    input: resolve(projectRoot, _options.entry ?? 'src/index.ts'),
  });

  const outputDev = await rollup({
    plugins: [
      typescript({
        tsconfig: resolve(projectRoot, 'tsconfig.lib.json'),
        tsconfigOverride: {
          compilerOptions: {
            declarationDir: '../../dist',
          },
        },
        useTsconfigDeclarationDir: true,
      }),
      define({
        replacements: {
          __DEV__: 'true',
          __TEST__: 'false',
        },
      }),
      filesize(),
    ],
    external,
    input: resolve(projectRoot, _options.entry ?? 'src/index.ts'),
  });

  const outputOptions: OutputOptions[] = [
    {
      format: 'esm' as const,
      file: resolve(outDir, `${_options.bundleName}.esm.js`),
    },
    {
      format: 'cjs' as const,
      file: resolve(outDir, `${_options.bundleName}.cjs`),
      exports: 'auto',
    },
  ];

  for (let option of outputOptions) {
    await output.write(option);
  }

  const outputDevOptions = [
    {
      format: 'esm' as const,
      file: resolve(outDir, `${_options.bundleName}.dev.esm.js`),
    },
  ];

  for (let option of outputDevOptions) {
    await outputDev.write(option);
  }

  const globalPackageJson = require(resolve(context.root, 'package.json'));
  if (packageJson.version === '0.0.0') {
    packageJson.version = globalPackageJson.version;
  }
  console.log(packageJson.version);

  packageJson.main = `${_options.bundleName}.cjs`;
  packageJson.module = `${_options.bundleName}.esm.js`;
  packageJson.type = 'module';
  packageJson.exports = {
    ...(packageJson.exports ?? {}),
    ...{
      '.': {
        development: `./${_options.bundleName}.dev.esm.js`,
        production: `./${_options.bundleName}.esm.js`,
        require: `./${_options.bundleName}.cjs`,
        default: `./${_options.bundleName}.esm.js`,
      },
    },
    './package.json': './package.json', // some cli tools may need this
  };
  packageJson.types = `src/index.d.ts`;

  for (const [key, value] of Object.entries(
    packageJson.peerDependencies ?? {}
  )) {
    if (value === '0.0.0') {
      packageJson.peerDependencies[key] = `^${packageJson.version}`; // TODO: match semver
    }
  }

  if (!packageJson.author) {
    packageJson.author = globalPackageJson.author;
  }

  if (!packageJson.license) {
    packageJson.license = globalPackageJson.license;
  }

  if (!packageJson.repository) {
    packageJson.repository = globalPackageJson.repository;
  }

  await writeFile(
    resolve(outDir, 'package.json'),
    JSON.stringify(packageJson, null, 4),
    {
      encoding: 'utf8',
    }
  );

  return {
    success: true,
  };
}

function createBaseOutput() {}
