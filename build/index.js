"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const chokidar_1 = __importDefault(require("chokidar"));
const path_1 = require("path");
const fs_extra_1 = require("fs-extra");
const npm_packlist_1 = __importDefault(require("npm-packlist"));
const execa_1 = __importDefault(require("execa"));
const chalk_1 = __importDefault(require("chalk"));
const inquirer_1 = __importDefault(require("inquirer"));
commander_1.program
    .option("--src <source>", "path to package", process.cwd())
    .requiredOption("--dest <destination>", "path to project")
    .option("--no-deps", "do not sync package dependencies")
    .option("--watch", "watch package for changes")
    .option("--verbose", "show more debug info")
    .option("--yes", "skip confirmation prompt");
commander_1.program.parse(process.argv);
const options = commander_1.program.opts();
const isSymlink = async function (path) {
    try {
        const stats = await (0, fs_extra_1.lstat)(path);
        return stats.isSymbolicLink();
    }
    catch (error) {
        if (error.code === "ENOENT") {
            return false;
        }
        throw error;
    }
};
const sync = async function () {
    try {
        const src = (0, path_1.resolve)(process.cwd(), options.src);
        const dest = (0, path_1.resolve)(process.cwd(), options.dest);
        if (src === dest) {
            throw new Error("Invalid source (same as destination)");
        }
        const packageJsonPath = (0, path_1.join)(src, "package.json");
        if (!(0, fs_extra_1.existsSync)(packageJsonPath)) {
            throw new Error("Invalid source (package.json file missing)");
        }
        const packageJson = await (0, fs_extra_1.readFile)(packageJsonPath, "utf8");
        const packageProperties = JSON.parse(packageJson);
        const packageName = packageProperties.name;
        if (!packageName) {
            throw new Error("Invalid source (package name missing)");
        }
        const packagePeerDepsPaths = [];
        if (typeof packageProperties.peerDependencies === "object") {
            for (const packagePeerDep of Object.keys(packageProperties.peerDependencies)) {
                packagePeerDepsPaths.push(`node_modules/${packagePeerDep}`);
            }
        }
        const packageFiles = await (0, npm_packlist_1.default)({ path: src });
        packageFiles.sort();
        const destNodeModulesPath = (0, path_1.join)(dest, "node_modules");
        if (!(0, fs_extra_1.existsSync)(destNodeModulesPath)) {
            throw new Error("Invalid destination (node_modules folder missing)");
        }
        const destPackagePath = (0, path_1.join)(destNodeModulesPath, packageName);
        let confirmation;
        if (options.yes) {
            confirmation = true;
        }
        else {
            console.info(`Syncing ${chalk_1.default.bold(packageName)} to ${chalk_1.default.bold(destPackagePath)}…`);
            const answers = await inquirer_1.default.prompt([
                {
                    type: "confirm",
                    message: "Do you wish to proceed?",
                    name: "confirmation",
                    default: false,
                },
            ]);
            confirmation = answers.confirmation;
        }
        if (confirmation !== true) {
            console.info(chalk_1.default.red("Cancelled!"));
            process.exit(0);
        }
        else {
            // Unlink npm-linked package
            if (await isSymlink(destPackagePath)) {
                await (0, fs_extra_1.unlink)(destPackagePath);
            }
            await (0, fs_extra_1.ensureDir)(destPackagePath);
            const copyPath = async function (path, verbose = false) {
                const srcPath = (0, path_1.join)(src, path);
                const destPath = (0, path_1.join)(destPackagePath, path);
                try {
                    await (0, fs_extra_1.copy)(srcPath, destPath);
                }
                catch (error) {
                    if (error.code !== "ENOENT") {
                        throw error;
                    }
                }
                if (verbose) {
                    console.info(`Copied ${chalk_1.default.bold(path)}`);
                }
            };
            const deletePath = async function (path, verbose = false) {
                const deletePath = (0, path_1.join)(destPackagePath, path);
                await (0, fs_extra_1.remove)(deletePath);
                if (verbose) {
                    console.info(`Deleted ${chalk_1.default.bold(path)}`);
                }
            };
            const execaArguments = [
                "--archive",
                "--delete",
                "--files-from",
                "-",
                "--recursive",
            ];
            for (const packagePeerDepsPath of packagePeerDepsPaths) {
                execaArguments.push("--exclude", packagePeerDepsPath);
            }
            execaArguments.push(src, destPackagePath);
            let execaInput = "";
            for (const packageFile of packageFiles) {
                execaInput += `${packageFile}\n`;
            }
            if (options.deps) {
                execaInput += "node_modules";
            }
            const { stdout } = await (0, execa_1.default)("rsync", execaArguments, {
                input: execaInput,
            });
            console.info(chalk_1.default.green(`Synced ${chalk_1.default.bold(packageName)} to ${chalk_1.default.bold(destPackagePath)} successfully!`));
            if (options.watch) {
                console.info(`Watching ${chalk_1.default.bold(packageName)} for changes…`);
                const chokidarPaths = packageFiles;
                const chokidarIgnore = [];
                if (options.deps) {
                    chokidarPaths.push("node_modules");
                    chokidarIgnore.push(...packagePeerDepsPaths);
                }
                chokidar_1.default
                    .watch(chokidarPaths, {
                    cwd: src,
                    ignored: chokidarIgnore,
                    ignoreInitial: true,
                })
                    .on("add", (path) => copyPath(path, options.verbose))
                    .on("change", (path) => copyPath(path, options.verbose))
                    .on("unlink", (path) => deletePath(path, options.verbose));
            }
        }
    }
    catch (error) {
        if (options.verbose) {
            throw error;
        }
        else {
            console.error(chalk_1.default.red(error.message));
            process.exit(1);
        }
    }
};
sync();
//# sourceMappingURL=index.js.map