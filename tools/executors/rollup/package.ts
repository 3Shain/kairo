import { ExecutorContext } from '@nrwl/devkit';
import { resolve, dirname } from 'path';
import copy from 'rollup-plugin-copy';
import { writeFile } from 'fs-extra';
import typescript from 'rollup-plugin-typescript2';
import { rollup } from 'rollup';

interface Options {
    externals: string[],
    entry: string,
    bundleName: string
}

export default async function (
    _options: Options,
    context: ExecutorContext
): Promise<{ success: boolean }> {
    const projectRoot = context.workspace.projects[context.projectName].root;
    const projectAbsoluteRoot = resolve(context.root, projectRoot);
    const outDir = resolve('dist', projectRoot);

    const output = await rollup({
        plugins: [
            typescript({
                tsconfig: resolve(projectRoot, 'tsconfig.lib.json'),
                tsconfigOverride: {
                    compilerOptions: {
                        declarationDir: '../../dist'
                    }
                },
                useTsconfigDeclarationDir: true
            }),
            copy({
                targets: [
                    {
                        src: [
                            resolve(projectRoot, 'README.md'),
                            resolve(projectRoot, 'package.json'),
                        ],
                        dest: outDir,
                    },
                ],
                hook: 'writeBundle',
            }) as any, // rollup plugin
        ],
        external: [..._options.externals],
        input: resolve(projectRoot, _options.entry ?? 'src/index.ts'),
    });

    const outputOptions = [
        {
            format: 'esm' as const,
            file: resolve(outDir, `${_options.bundleName}.esm.js`),
        },
        {
            format: 'cjs' as const,
            file: resolve(outDir, `${_options.bundleName}.cjs.js`),
        }
    ]

    for (let option of outputOptions) {
        await output.write(option);
    }

    const globalPackageJson = require(resolve(context.root, 'package.json'));
    console.log(globalPackageJson.version);

    const packageJson = require(resolve(projectAbsoluteRoot, 'package.json'));
    packageJson.version = globalPackageJson.version;

    packageJson.main = `${_options.bundleName}.cjs.js`;
    packageJson.module = `${_options.bundleName}.esm.js`;
    packageJson.types = `src/index.d.ts`;

    for (const [key, value] of Object.entries(packageJson.peerDependencies)) {
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
