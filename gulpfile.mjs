import { series, watch as gulpWatch, src, dest } from 'gulp';
import { deleteAsync } from 'del';

function clean() {
  return deleteAsync(['build/*']);
}

function copy() {
  return src(
    [
      'src/background.js',
      'src/utils/*.js',
      'src/contentscript.js',
      'src/manifest.json',
      'src/new_message.mp3',
      'src/images/*.png',
      'src/options.html',
      'src/options.js',
    ],
    {
      base: './src',

      // fixes corrupted images issue
      removeBOM: false,
    }
  ).pipe(dest('build'));
}

export function watch() {
  gulpWatch(['src/**/*'], { ignoreInitial: false }, defaultTask);
}

const defaultTask = series(clean, copy);
export default defaultTask;
