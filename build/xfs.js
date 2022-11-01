const globModule = require('glob');
const path = require('path');
const mkdir = require('mkdirp');
const fs = require('fs');
const thenify = require('./thenify');

const readFile = thenify(fs.readFile);
const writeFile = thenify(fs.writeFile);
const readdir = thenify(fs.readdir);
const stat = thenify(fs.stat);

const mkdirp = thenify(mkdir);
const read = (file, opts = { encoding: 'utf8' }) => readFile(file, opts);
const glob = thenify(globModule);

const write = async (file, contents, options) => {
  const dir = path.dirname(file);
  await mkdirp(dir);
  return await writeFile(file, contents, options);
};

module.exports = {
  write,
  read,
  glob,
  readdir,
  stat,
};
