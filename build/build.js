const cheerio = require('cheerio');
const path = require('path');
const startCase = require('lodash.startcase');
const { transformAsync } = require('@babel/core');

const { subtle, ok, error, warn } = require('clix-logger/logger');
const { convertSvg } = require('react-native-expo-svg/src/convert');
const { toCSSObject } = require('./to-css-object');

const { glob, read, write, readdir, stat } = require('./xfs');

const getDimensionsFrom = viewBox => {
  const [, , viewBoxWidth, viewBoxHeight] = viewBox.split(/\s+/);
  return { viewBoxWidth, viewBoxHeight };
};

const transform = async (content, options = {}) =>
  await transformAsync(content, {
    ...options,
    configFile: false,
    presets: [
      [
        '@babel/preset-env',
        {
          targets: {
            chrome: '80',
          },
        },
      ],
      '@babel/preset-react',
    ],
  });

const tryParse = (str, defaultObj) => {
  let returnedObj;
  try {
    returnedObj = JSON.parse(str);

    if (typeof returnedObj === 'undefined' || returnedObj === null) {
      returnedObj = defaultObj;
    }
  } catch (ex) {
    returnedObj = defaultObj;
  }

  return returnedObj;
};

const renderPropsAsObject = props =>
  Object.keys(props).reduce((acc, key) => {
    const val = tryParse(props[key], props[key]);
    if (typeof val !== 'undefined') {
      acc += `${key}: ${JSON.stringify(val)}, `;
    }
    return acc;
  }, ' ');

const writeReactNativeSVG = async (filename, svg, usedElements, props) => {
  svg = svg.replace(/<Svg>/, '<Svg {...svgProps}>');
  const name = path.basename(filename, '.js');
  const iconName = `${startCase(`${name.replace('.js', '')}`)
    .replace(/-/g, '')
    .replace(/\s+/g, '')}`;
  const svgComponent = `
const React = require('react');
const { ${usedElements.join(', ')} } = require('react-native-svg');

export function ${iconName}(props) {
  const svgProps = Object.assign({
    ${renderPropsAsObject(props)}
  }, props)
return (
  ${svg}
);
}
`.trim();

  const { code } = await transform(svgComponent, { filename });

  await write(filename, code);
};

const writeWebFile = async (filename, svg, props) => {
  svg = svg.replace(/<svg>/, '<svg { ...svgProps }>');
  const name = path.basename(filename, '.js');
  const iconName = `${startCase(`${name.replace('.js', '')}`)
    .replace(/-/g, '')
    .replace(/\s+/g, '')}`;

  svg = svg.replace(/style="(.*?)"/g, (match, p1) => `style={${JSON.stringify(toCSSObject(p1))}}`);

  const svgComponent = `
const React = require('react');

export function ${iconName}(props) {
  const svgProps = Object.assign({
    ${renderPropsAsObject(props)}
    xmlns: "http://www.w3.org/2000/svg",
  }, props);
return (
  ${svg}
);
}
`.trim();

  const { code } = await transform(svgComponent, { filename });
  write(filename, code);
};

const getFoldersInPath = async pathToFolder => {
  const entries = await readdir(pathToFolder);
  const result = [];
  for (const entry of entries) {
    const entryWithPath = path.join(pathToFolder, entry);
    const fstat = await stat(entryWithPath);
    if (fstat.isDirectory()) {
      result.push({ path: entryWithPath, name: entry });
    }
  }

  return result;
};

const generateImports = spriteModules => {
  const result = [];
  for (const entry of spriteModules) {
    const { name, pathToModule } = entry;
    result.push(`${name}: require('${pathToModule}')`);
  }

  return result.join(',\n');
};

const writeSprites = async ({ outputDir, svgData }) => {
  const spritesPath = path.join(outputDir, './sprites');
  const modules = await Promise.all(
    svgData.map(async entry => {
      const moduleName = `${entry.name}.js`;
      const hash = entry.svgs.reduce((acc, svg) => {
        acc[svg.name] = svg.content;
        return acc;
      }, {});
      await write(path.join(spritesPath, moduleName), `module.exports = ${JSON.stringify(hash, null, 2)}`);
      return { name: entry.name, pathToModule: `./${path.join('./sprites', moduleName)}` };
    }),
  );

  await write(path.join(outputDir, 'index.js'), `module.exports = { ${generateImports(modules)} };`);
};

const writeNativeSvgs = async ({ outputDir, svgData }) => {
  await Promise.all(
    svgData.map(async entry =>
      Promise.all(
        entry.svgs.map(async svgEntry => {
          try {
            const { RNSvg, usedElements } = await convertSvg(svgEntry.raw);
            const outputPath = path.join(outputDir, svgEntry.source.replace(/\.svg$/, '.js'));
            await writeReactNativeSVG(outputPath, RNSvg, usedElements, svgEntry.props);
          } catch (err) {
            warn('error generating svg for react-native', err);
          }
        }),
      ),
    ),
  );
};

const writeWebSvgs = async ({ svgData, outputDir }) => {
  await Promise.all(
    svgData.map(async entry =>
      Promise.all(
        entry.svgs.map(async svgEntry => {
          const outputPath = path.join(outputDir, svgEntry.source.replace(/\.svg$/, '.js'));
          await writeWebFile(outputPath, svgEntry.raw, svgEntry.props);
        }),
      ),
    ),
  );
};

const readSVGFile = async file => {
  const name = path.basename(file, '.svg');
  const text = await read(file, { encoding: 'utf8' });

  const $ = cheerio.load(text);

  const styles = $('style');

  styles.remove();

  const elementsWithFill = $('svg *');
  elementsWithFill.removeAttr('fill');
  elementsWithFill.removeAttr('class');
  elementsWithFill.removeAttr('stroke');
  elementsWithFill.removeAttr('fill-rule');
  elementsWithFill.removeAttr('clip-rule');

  const svg = $('svg');

  const viewBox = svg.attr('viewBox');

  let width = svg.attr('width');
  let height = svg.attr('height');

  if (viewBox) {
    const { viewBoxWidth, viewBoxHeight } = getDimensionsFrom(viewBox);
    width = width ?? viewBoxWidth;
    height = height ?? viewBoxHeight;
  }

  const childrenCount = svg.find('> *').length;

  let svgInner = svg.html().trim();

  if (childrenCount > 1) {
    svgInner = `<g>${svgInner}</g>`;
  }

  const svgRaw = `
  <svg>${svgInner}</svg>`
    .trim()
    .replace(/\n\s{8}/g, '\n');

  return {
    props: { width, height, viewBox },
    name,
    content: svgInner,
    raw: svgRaw,
  };
};

const getSVGData = async (dirEntry, sourcePath) => {
  const svgsInDir = await glob(path.join(`${dirEntry.path}`, '**/*.svg'));
  const svgs = await Promise.all(
    svgsInDir.map(async svgFile => {
      const result = await readSVGFile(svgFile);
      return {
        source: path.relative(sourcePath, svgFile),
        ...result,
      };
    }),
  );

  return {
    name: dirEntry.name,
    svgs,
  };
};

const writeData = async svgData => {
  const reactNativePath = './dist/native';
  const reactWebPath = './dist/web';
  const spritesPath = './dist/';

  const p1 = writeSprites({ outputDir: spritesPath, svgData });
  const p2 = writeWebSvgs({ outputDir: reactWebPath, svgData });
  const p3 = writeNativeSvgs({ outputDir: reactNativePath, svgData });

  await Promise.all([p1, p2, p3]);
};

const main = async () => {
  try {
    const sourcePath = './resources';
    subtle('reading folders...');
    const dirs = await getFoldersInPath(sourcePath);
    const svgData = await Promise.all(dirs.map(entry => getSVGData(entry, sourcePath)));
    subtle('writing the output...');

    await writeData(svgData);

    ok('Done!');
  } catch (err) {
    error('[svg-sprite]', err);
    process.exit(1); // eslint-disable-line no-process-exit
  }
};

main();
