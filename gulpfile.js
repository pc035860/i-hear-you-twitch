const gulp = require('gulp');
const del = require('del');

gulp.task('clean', function () {
  return del(['build']);
});

gulp.task('copy', ['clean'], function () {
  return gulp.src([
    'background.js',
    'contentscript.js',
    'manifest.json',
    'new_message.mp3',
    'images/*.png'
  ], { base: './' })
  .pipe(gulp.dest('build'));
});

gulp.task('default', ['clean', 'copy']);
