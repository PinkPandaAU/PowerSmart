const gulp = require("gulp"),
  concat = require("gulp-concat"),
  autoprefix = require("gulp-autoprefixer"),
  cleanCSS = require("gulp-clean-css"),
  terser = require("gulp-terser"),
  sourcemaps = require("gulp-sourcemaps"),
  cache = require("gulp-cached"),
  del = require("del"),
  sass = require("gulp-sass")(require("sass")),
  sassGlob = require("gulp-sass-glob"),
  svgSprite = require("gulp-svg-sprite");

(src = {
  cssmain: "scss/main/*.scss",
  cssdev: "scss/dev.scss",
  jslib: "js/plugins/*.js",
  jsdev: "js/theme.js",
  images: "images/**/*.*",
  icons: "images/icons/*.svg",
  favicons: "favicons/**/*.*",
}),
  (build = {
    images: "../assets/images",
    css: "../assets",
    js: "../assets",
    favicons: "../assets/favicons",
  });

function favicons() {
  return gulp.src(src.favicons).pipe(gulp.dest(build.favicons));
}

function fonts() {
  return gulp.src("fonts/**/*.{eot,svg,ttf,woff,woff2}").pipe(gulp.dest("../assets/fonts"));
}

function images() {
  return gulp.src(src.images).pipe(cache()).pipe(gulp.dest(build.images));
}

function icons() {
  return gulp
    .src(src.icons)
    .pipe(
      svgSprite({
        mode: {
          stack: {
            sprite: "../sprite.svg",
          },
        },
        shape: {
          transform: [],
        },
      })
    )
    .pipe(gulp.dest(build.images));
}

function mainCSS() {
  return gulp
    .src(src.cssmain)
    .pipe(sass().on("error", sass.logError))
    .pipe(autoprefix())
    .pipe(cleanCSS({ level: 1 }))
    .pipe(gulp.dest(build.css));
}

function devCSS() {
  return gulp
    .src(src.cssdev)
    .pipe(sassGlob())
    .pipe(sass().on("error", sass.logError))
    .pipe(concat("style.css"))
    .pipe(autoprefix())
    .pipe(cleanCSS({ level: 1 }))
    .pipe(gulp.dest(build.css));
}

function pluginsJS() {
  return gulp.src(src.jslib).pipe(concat("plugins.js")).pipe(gulp.dest(build.js));
}

function themeJS() {
  return gulp.src(src.jsdev).pipe(sourcemaps.init()).pipe(terser()).pipe(sourcemaps.write(".")).pipe(gulp.dest(build.js));
}

function cleanAssets() {
  return del(["../assets/images/*", "../assets/fonts/*", "../assets/favicons/*", "../assets/style.css", "../assets/theme.js", "../assets/plugins.js", "../assets/sprite.svg"], { force: true });
}

function watch(done) {
  gulp.watch("scss/**/*.scss", mainCSS);
  gulp.watch("scss/**/*.scss", devCSS);
  gulp.watch(src.jslib, pluginsJS);
  gulp.watch(src.jsdev, themeJS);
  gulp.watch(src.images, images);
  gulp.watch(src.icons, icons);
  gulp.watch(src.favicons, favicons);
  console.log("\n✔ Watching for changes in scss/, js/, images/, favicons/...\n  Press Ctrl+C to stop.\n");
  done();
}

gulp.task("favicons", favicons);
gulp.task("fonts", fonts);
gulp.task("images", images);
gulp.task("icons", icons);
gulp.task("mainCSS", mainCSS);
gulp.task("devCSS", devCSS);
gulp.task("pluginsJS", pluginsJS);
gulp.task("themeJS", themeJS);
gulp.task("cleanAssets", cleanAssets);
gulp.task("watch", watch);
gulp.task("build", gulp.series("cleanAssets", gulp.parallel("icons", "mainCSS", "devCSS", "themeJS", "pluginsJS", "fonts", "images", "favicons")));
gulp.task("default", gulp.series("build"));
gulp.task("watch", gulp.series("build", watch));
