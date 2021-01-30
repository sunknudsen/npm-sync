# npm-sync

## Sync npm packages between projects.

This project was developed to fix React hook [issues](https://github.com/facebook/react/issues/13991) caused by `npm link`.

## Features

- Super simple to use
- Uses `rsync` to efficiently sync files
- Uses npm’s official [npm-packlist](https://www.npmjs.com/package/npm-packlist) to establish which files to sync
- Uses trusted dependencies ([chokidar](https://www.npmjs.com/package/chokidar), [commander](https://www.npmjs.com/package/commander), [fs-extra](https://www.npmjs.com/package/fs-extra), etc…)
- Very light codebase to audit (less than 200 lines of code)
- Written in TypeScript

## Installation

> Heads-up: `npm-sync` depends on `rsync` which is installed by default on macOS.

```shell
npm install -g npm-sync
```

## Usage

```console
$ npm-sync -h
Usage: npm-sync [options]
Options:
  --src <source>        path to package (default: process.cwd())
  --dest <destination>  path to project
  --no-deps             do not sync package dependencies
  --watch               watch package for changes
  --verbose             show more debug info
  --yes                 skip confirmation prompt
  -h, --help            display help for command
```

## Example

In following example, we are developing a React component called `react-cms` (packaged as `@sunknudsen/react-cms`) that we are planning to publish to npm.

Before publishing `@sunknudsen/react-cms`, we would like to import component from project called `sunknudsen-website` to see if everything is working (we tried `npm link` and things were [broken](https://github.com/facebook/react/issues/13991)).

```console
$ pwd
/Users/sunknudsen/Code/sunknudsen/react-cms

$ npm-sync --dest /Users/sunknudsen/Code/sunknudsen/sunknudsen-website --watch
Syncing @sunknudsen/react-cms to /Users/sunknudsen/Code/sunknudsen/sunknudsen-website/node_modules/@sunknudsen/react-cms…
? Do you wish to proceed? Yes
Synced @sunknudsen/react-cms to to /Users/sunknudsen/Code/sunknudsen/sunknudsen-website/node_modules/@sunknudsen/react-cms
Watching @sunknudsen/react-cms for changes…
```

## Contributors

[Sun Knudsen](https://sunknudsen.com/)

## Licence

MIT
