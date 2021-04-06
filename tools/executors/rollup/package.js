"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var path_1 = require("path");
var rollup_plugin_copy_1 = __importDefault(require("rollup-plugin-copy"));
var fs_extra_1 = require("fs-extra");
var rollup_plugin_typescript2_1 = __importDefault(require("rollup-plugin-typescript2"));
var rollup_1 = require("rollup");
function default_1(_options, context) {
    var _a;
    return __awaiter(this, void 0, void 0, function () {
        var projectRoot, projectAbsoluteRoot, outDir, output, outputOptions, _i, outputOptions_1, option, globalPackageJson, packageJson, _b, _c, _d, key, value;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    projectRoot = context.workspace.projects[context.projectName].root;
                    projectAbsoluteRoot = path_1.resolve(context.root, projectRoot);
                    outDir = path_1.resolve('dist', projectRoot);
                    return [4 /*yield*/, rollup_1.rollup({
                            plugins: [
                                rollup_plugin_typescript2_1.default({
                                    tsconfig: path_1.resolve(projectRoot, 'tsconfig.lib.json'),
                                    tsconfigOverride: {
                                        compilerOptions: {
                                            declarationDir: '../../dist'
                                        }
                                    },
                                    useTsconfigDeclarationDir: true
                                }),
                                rollup_plugin_copy_1.default({
                                    targets: [
                                        {
                                            src: [
                                                path_1.resolve(projectRoot, 'README.md'),
                                                path_1.resolve(projectRoot, 'package.json'),
                                            ],
                                            dest: outDir,
                                        },
                                    ],
                                    hook: 'writeBundle',
                                }),
                            ],
                            external: __spreadArrays(_options.externals),
                            input: path_1.resolve(projectRoot, (_a = _options.entry) !== null && _a !== void 0 ? _a : 'src/index.ts'),
                        })];
                case 1:
                    output = _e.sent();
                    outputOptions = [
                        {
                            format: 'esm',
                            file: path_1.resolve(outDir, _options.bundleName + ".esm.js"),
                        },
                        {
                            format: 'cjs',
                            file: path_1.resolve(outDir, _options.bundleName + ".cjs.js"),
                        }
                    ];
                    _i = 0, outputOptions_1 = outputOptions;
                    _e.label = 2;
                case 2:
                    if (!(_i < outputOptions_1.length)) return [3 /*break*/, 5];
                    option = outputOptions_1[_i];
                    return [4 /*yield*/, output.write(option)];
                case 3:
                    _e.sent();
                    _e.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5:
                    globalPackageJson = require(path_1.resolve(context.root, 'package.json'));
                    console.log(globalPackageJson.version);
                    packageJson = require(path_1.resolve(projectAbsoluteRoot, 'package.json'));
                    packageJson.version = globalPackageJson.version;
                    packageJson.main = _options.bundleName + ".cjs.js";
                    packageJson.module = _options.bundleName + ".esm.js";
                    packageJson.types = "src/index.d.ts";
                    for (_b = 0, _c = Object.entries(packageJson.peerDependencies); _b < _c.length; _b++) {
                        _d = _c[_b], key = _d[0], value = _d[1];
                        if (value === '0.0.0') {
                            packageJson.peerDependencies[key] = "^" + packageJson.version; // TODO: match semver
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
                    return [4 /*yield*/, fs_extra_1.writeFile(path_1.resolve(outDir, 'package.json'), JSON.stringify(packageJson, null, 4), {
                            encoding: 'utf8',
                        })];
                case 6:
                    _e.sent();
                    return [2 /*return*/, {
                            success: true,
                        }];
            }
        });
    });
}
exports.default = default_1;
