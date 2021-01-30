"use strict"

import program from "commander"
import chokidar from "chokidar"
import { join, resolve } from "path"
import {
  lstat,
  existsSync,
  readFile,
  ensureDir,
  unlink,
  copy,
  remove,
} from "fs-extra"
import packlist from "npm-packlist"
import execa from "execa"
import chalk from "chalk"
import inquirer from "inquirer"

program
  .option("--src <source>", "path to package", process.cwd())
  .requiredOption("--dest <destination>", "path to project")
  .option("--no-deps", "do not sync package dependencies")
  .option("--watch", "watch package for changes")
  .option("--verbose", "show more debug info")
  .option("--yes", "skip confirmation prompt")

program.parse(process.argv)

const isSymlink = async function (path: string) {
  try {
    const stats = await lstat(path)
    return stats.isSymbolicLink()
  } catch (error) {
    if (error.code === "ENOENT") {
      return false
    }
    throw error
  }
}

const sync = async function () {
  try {
    const options = program.opts()

    const src = resolve(process.cwd(), options.src)
    const dest = resolve(process.cwd(), options.dest)

    const packageJsonPath = join(src, "package.json")
    if (!existsSync(packageJsonPath)) {
      throw new Error("Invalid source (package.json file missing)")
    }

    const packageJson = await readFile(packageJsonPath, "utf8")
    const packageProperties = JSON.parse(packageJson)
    const packageName = packageProperties.name
    if (!packageName) {
      throw new Error("Invalid source (package name missing)")
    }
    const packagePeerDeps = Object.keys(packageProperties.peerDependencies)
    const packagePeerDepsPaths = []
    for (const packagePeerDep of packagePeerDeps) {
      packagePeerDepsPaths.push(`node_modules/${packagePeerDep}`)
    }

    const packageFiles = await packlist({ path: src })
    packageFiles.sort()

    const destNodeModulesPath = join(dest, "node_modules")
    if (!existsSync(destNodeModulesPath)) {
      throw new Error("Invalid destination (node_modules folder missing)")
    }

    const destPackagePath = join(destNodeModulesPath, packageName)

    let confirmation = true

    if (!options.yes) {
      console.log(
        `Syncing ${chalk.bold(packageName)} to ${chalk.bold(destPackagePath)}…`
      )

      const answers = await inquirer.prompt([
        {
          type: "confirm",
          message: "Do you wish to proceed?",
          name: "confirmation",
          default: false,
        },
      ])

      confirmation = answers.confirmation
    }

    if (confirmation === true) {
      // Unlink npm-linked package
      if (await isSymlink(destPackagePath)) {
        await unlink(destPackagePath)
      }

      await ensureDir(destPackagePath)

      const copyPath = async function (path: string, verbose: boolean = false) {
        const srcPath = join(src, path)
        const destPath = join(destPackagePath, path)
        await copy(srcPath, destPath)
        if (verbose) {
          console.info(`Copied ${chalk.bold(path)}`)
        }
      }

      const deletePath = async function (
        path: string,
        verbose: boolean = false
      ) {
        const deletePath = join(destPackagePath, path)
        await remove(deletePath)
        if (verbose) {
          console.info(`Deleted ${chalk.bold(path)}`)
        }
      }

      const execaArguments = [
        "--archive",
        "--delete",
        "--files-from",
        "-",
        "--recursive",
      ]
      for (const packagePeerDepsPath of packagePeerDepsPaths) {
        execaArguments.push("--exclude", packagePeerDepsPath)
      }
      execaArguments.push(src, destPackagePath)

      let execaInput = ""
      for (const packageFile of packageFiles) {
        execaInput += `${packageFile}\n`
      }
      if (options.deps) {
        execaInput += "node_modules"
      }

      const { stdout } = await execa("rsync", execaArguments, {
        input: execaInput,
      })

      console.log(
        `Synced ${chalk.bold(packageName)} to ${chalk.bold(destPackagePath)}`
      )

      if (options.watch) {
        console.log(`Watching ${chalk.bold(packageName)} for changes…`)

        const chokidarPaths = packageFiles
        const chokidarIgnore = []

        if (options.deps) {
          chokidarPaths.push("node_modules")
          chokidarIgnore.push(...packagePeerDepsPaths)
        }

        chokidar
          .watch(chokidarPaths, {
            cwd: src,
            ignored: chokidarIgnore,
            ignoreInitial: true,
          })
          .on("add", (path) => copyPath(path, options.verbose))
          .on("change", (path) => copyPath(path, options.verbose))
          .on("unlink", (path) => deletePath(path, options.verbose))
      }
    }
  } catch (error) {
    console.error(chalk.red(error.message))
    process.exit(1)
  }
}

sync()
