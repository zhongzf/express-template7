import * as glob from 'glob';
import * as fs from 'graceful-fs';
import * as path from 'path';
import * as template7 from './template7';

export class ExpressTemplate7 {
    engine: any;
    compiled: any;
    cache: any;

    constructor(config) {
        // Config properties with defaults.
        Object.assign(this, {
            template7: template7.Template7,
            Template7: template7.Template7,
            extname: '.html',
            layoutsDir: 'views/layouts/',
            partialsDir: 'views/partials/',
            defaultLayout: undefined,
            helpers: undefined,
            compilerOptions: undefined,
        }, config);

        // Express view engine integration point.
        this.engine = this.renderView.bind(this);

        // Normalize `extname`.
        if (this.extname.charAt(0) !== '.') {
            this.extname = '.' + this.extname;
        }

        // Internal caches of compiled and precompiled templates.
        this.compiled = Object.create(null);

        // Private internal file system cache.
        this.cache = Object.create(null);
    }

    render(filePath, context, options, _this) {
        options || (options = {});

        return Promise.all([
            _this.getTemplate(filePath, { cache: options.cache }, _this),
            options.partials || _this.getPartials({ cache: options.cache })
        ])
            .then(function (templates) {
                var template = templates[0];
                var partials = templates[1];
                var helpers = options.helpers || _this.helpers;

                var model = Object.assign({}, context, {
                    template7: Object.assign({}, options, {
                        filePath: filePath,
                        helpers: helpers,
                        partials: partials,
                    }),
                    Template7: template7.Template7
                });

                return template(model);
            });
    }

    renderView(viewPath, options, callback) {
        options || (options = {});
        var context = options;

        // Express provides `settings.views` which is the path to the views dir that
        // the developer set on the Express app. When this value exists, it's used
        // to compute the view's name. Layouts and Partials directories are relative
        // to `settings.view` path
        var view;
        var viewsPath = options.settings && options.settings.views;
        if (viewsPath) {
            view = this.getTemplateName(path.relative(viewsPath, viewPath));
            this.partialsDir = path.join(viewsPath, 'partials/');
            this.layoutsDir = path.join(viewsPath, 'layouts/');
        }


        // Merge render-level and instance-level helpers together.
        var helpers = Object.assign({}, this.helpers, options.helpers);

        // Merge render-level and instance-level partials together.
        var partials = Promise.all([
            this.getPartials({ cache: options.cache }),
            Promise.resolve(options.partials),
        ]).then(function (partials) {
            return Object.assign.apply(null, [{}].concat(partials));
        });


        // Pluck-out ExpressHandlebars-specific options and Handlebars-specific
        // rendering options.
        options = {
            cache: options.cache,
            view: view,
            layout: 'layout' in options ? options.layout : this.defaultLayout,

            model: options.model,
            helpers: helpers,
            partials: partials,
        };

        var _this = this;
        this.render(viewPath, context, options, _this)
            .then(function (body) {
                var layoutPath = _this.resolveLayoutPath(_this.layoutsDir, options.layout, _this.extname);

                if (layoutPath) {
                    return _this.render(
                        layoutPath,
                        Object.assign({}, context, { body: body }),
                        Object.assign({}, options, { layout: undefined }),
                        _this
                    );
                }

                return body;
            })
            .then(this.passValue(callback))
            .catch(this.passError(callback));
    }


    getTemplateName(filePath, namespace, extname) {
        var extRegex = new RegExp(extname + '$');
        var name = filePath.replace(extRegex, '');

        if (namespace) {
            name = namespace + '/' + name;
        }
        return name;
    }

    getDir(dirPath, options) {
        dirPath = path.resolve(dirPath);
        options || (options = {});

        var cache = this.cache;
        var dir = options.cache && cache[dirPath];

        if (dir) {
            return dir.then(function (dir) {
                return dir.concat();
            });
        }

        var pattern = '**/*' + this.extname;

        // Optimistically cache dir promise to reduce file system I/O, but remove
        // from cache if there was a problem.
        dir = cache[dirPath] = new Promise(function (resolve, reject) {
            glob(pattern, {
                cwd: dirPath,
                follow: true
            }, function (err, dir) {
                if (err) {
                    reject(err);
                } else {
                    resolve(dir);
                }
            });
        });

        return dir
            .then(function (dir) {
                return dir.concat();
            })
            .catch(function (err) {
                delete cache[dirPath];
                throw err;
            });
    }

    getFile(filePath, options) {
        filePath = path.resolve(filePath);
        options || (options = {});

        var cache = this.cache;
        var file = options.cache && cache[filePath];

        if (file) {
            return file;
        }

        // Optimistically cache file promise to reduce file system I/O, but remove
        // from cache if there was a problem.
        file = cache[filePath] = new Promise(function (resolve, reject) {
            fs.readFile(filePath, 'utf8', function (err, file) {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(file);
                }
            });
        });

        return file.catch(function (err) {
            delete cache[filePath];
            throw err;
        });
    }

    getTemplate(filePath, options, _this) {
        filePath = path.resolve(filePath);
        options || (options = {});

        var cache = _this.compiled;
        var template = options.cache && cache[filePath];

        if (template) {
            return template;
        }

        // Optimistically cache template promise to reduce file system I/O, but
        // remove from cache if there was a problem.
        var compilerOptions = Object.assign({}, _this.compilerOptions, {Template7: template7.Template7});
        template = cache[filePath] = _this.getFile(filePath, { cache: options.cache })
            .then(function (file) {
                return template7.Template7.compile(file, compilerOptions);
            });

        return template.catch(function (err) {
            delete cache[filePath];
            throw err;
        });
    }

    getTemplates = function (dirPath, options) {
        options || (options = {});
        var cache = options.cache;

        var _this = this;
        return this.getDir(dirPath, { cache: cache }).then(function (filePaths) {
            var templates = filePaths.map(function (filePath) {
                return _this.getTemplate(path.join(dirPath, filePath), options, _this);
            }, this);

            return Promise.all(templates).then(function (templates) {
                return filePaths.reduce(function (hash, filePath, i) {
                    hash[filePath] = templates[i];
                    return hash;
                }, {});
            });
        });
    }

    getPartials(options) {
        var _this = this;
        var partialsDirs = Array.isArray(this.partialsDir) ?
            this.partialsDir : [this.partialsDir];

        partialsDirs = partialsDirs.map(function (dir) {
            var dirPath;
            var dirTemplates;
            var dirNamespace;

            // Support `partialsDir` collection with object entries that contain a
            // templates promise and a namespace.
            if (typeof dir === 'string') {
                dirPath = dir;
            } else if (typeof dir === 'object') {
                dirTemplates = dir.templates;
                dirNamespace = dir.namespace;
                dirPath = dir.dir;
            }

            // We must have some path to templates, or templates themselves.
            if (!(dirPath || dirTemplates)) {
                throw new Error('A partials dir must be a string or config object');
            }

            // Make sure we're have a promise for the templates.
            var templatesPromise = dirTemplates ? Promise.resolve(dirTemplates) :
                this.getTemplates(dirPath, options);

            return templatesPromise.then(function (templates) {
                return {
                    templates: templates,
                    namespace: dirNamespace,
                };
            });
        }, this);

        return Promise.all(partialsDirs).then(function (dirs) {
            return dirs.reduce(function (partials, dir) {
                var templates = dir.templates;
                var namespace = dir.namespace;
                var filePaths = Object.keys(templates);

                filePaths.forEach(function (filePath) {
                    var partialName = _this.getTemplateName(filePath, namespace, _this.extname);
                    partials[partialName] = templates[filePath];
                });

                return partials;
            }, {});
        });
    };

    resolveLayoutPath = function (layoutsDir, layoutPath, extname) {
        if (!layoutPath) {
            return null;
        }

        if (!path.extname(layoutPath)) {
            layoutPath += extname;
        }

        return path.resolve(layoutsDir, layoutPath);
    }

    //#region utils
    passValue(callback) {
        return function (value) {
            setImmediate(function () {
                callback(null, value);
            });
        };
    }

    passError(callback) {
        return function (reason) {
            setImmediate(function () {
                callback(reason);
            });
        };
    }
    //#endregion
}