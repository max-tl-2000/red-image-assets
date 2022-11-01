# red-image-assets

This contains the shared icons and visual assets across Reva projects.

## Organization of resources

The repository is broken down into a few key areas.  This is fairly self-explanatory, but the summary should help with a few key details.

* `./originals` contains the original files used to generate some of the resources used.  These are typically Illustrator (.ai) files that either output more complex SVG or rasterized images.  For example, the original Illustrator files used to generate favicons are here, so we can easily make changes or improvements and rerender all of the raster images needed.  These are only used in manual processes right now, because it's pretty rare we need to change these original files.  Also note that some of the originals can be stored directly in Figma now.  We may end up migrating the rest of this folder to Figma over time, but there are still a few things that don't quite translate well from Illustrator.

* `./resources/launchers` contains the favicons, launchers, and splash screens used for various Reva apps across different platforms.  The naming convention (`./resources/launchers/[<tenant>_<module>]/[env]/[context]`) of the folder structure gives how the icons will be used per environment.  The tenant and module (core, rxp, etc.) give the top-level separation, because this is quite important (`reva` for the default/fallback when no white-labeling is used).  For example, `./resources/launchers/reva_core/prod/favicons` includes favicons for the main red app (leasing, resident services, etc.) in the production environment.

* `/resources/icons` contains the 24x24 SVG icons.  These are further decomposed into subdirectories as neccessary (currently based upon usage context).  These are all monochromatic icons.  These can be wrapped and scaled up/down responsively in mod4 decrements/increments including 16, 24, 36, 48, 64, and 72.  This covers all common sizes needed at different screen densities if we need to rasterize them at some point, although we prefer to keep them in vector form.  We can also generate an icon font from this set of icons quite easily, but will need to define a consistent convention for ordering them in the font library.

TBD: We may need to further decompose the UI folder at some point.  There's a bunch of overlap and re-use though, so it isn't clear how best to organize this right now.

* `/resources/pictographs` contains larger SVG pictographs used across the Reva apps (e.g., 404, 500, bookmarks, etc.).  These are not necessarily 24x24, and typically not monochromatic.

* `/resources/raster` contains rasterized static images we need.  Generally these are either too complex to store efficiently as vectors, or used in combination with Cloudinary for dynamic rendering.

## Samples and helpful reminders

* `./samples` contains a few examples, templates, etc. that are handy.

* You can quickly optimize a directory of PNGs using `find . -name '*.png' -print0 | xargs -0 -P8 -L4 pngquant --ext .png --force --speed 1 --strip 256`.  Requires pngquant of course.

* Compling the .ico version is easy with ImageMagick using `convert -alpha Background -colors 16 -depth 4 +dither favicon-16.png favicon-24.png favicon-32.png favicon-48.png favicon-64.png favicon.ico && rm favicon-16.png favicon-24.png favicon-32.png favicon-48.png favicon-64.png`
