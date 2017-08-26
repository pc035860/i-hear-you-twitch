const gulp = require('gulp');
const del = require('del');

gulp.task('clean', function () {
  return del(['build']);
});

gulp.task('copy', ['clean'], function () {
  return gulp.src([
    'src/background.js',
    'src/contentscript.js',
    'src/manifest.json',
    'src/new_message.mp3',
    'src/images/*.png'
  ], { base: './src' })
  .pipe(gulp.dest('build'));
});

gulp.task('default', ['clean', 'copy']);
